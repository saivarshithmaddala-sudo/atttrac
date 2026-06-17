import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processPunches } from '@/lib/jobs/ingestionProcessor'

/**
 * POST /api/biometric/sync
 * 
 * Connects directly to the ESSL/ZKTeco machine over TCP (port 4370),
 * pulls all attendance logs, stores them as RawPunchLog, then processes them.
 * 
 * Body (optional): { ip?: string, port?: number, commKey?: number }
 * Falls back to env vars: BIOMETRIC_IP, BIOMETRIC_PORT, BIOMETRIC_COMM_KEY
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))

    const ip = body.ip || process.env.BIOMETRIC_IP
    const port = body.port || parseInt(process.env.BIOMETRIC_PORT || '4370')
    const commKey = body.commKey ?? parseInt(process.env.BIOMETRIC_COMM_KEY || '0')

    if (!ip) {
      return NextResponse.json({ error: 'Biometric machine IP not configured. Set BIOMETRIC_IP in .env or pass ip in body.' }, { status: 400 })
    }

    // Dynamically import node-zklib (CommonJS module)
    const ZKLib = require('node-zklib')
    const zk = new ZKLib(ip, port, 10000, 4000, commKey, 'tcp')

    let attendance: any[] = []

    try {
      await zk.createSocket()
      console.log(`[ZK-SYNC] Connected to ${ip}:${port}`)

      const result = await zk.getAttendances((received: number, total: number) => {
        console.log(`[ZK-SYNC] Downloading ${received}/${total}`)
      })

      attendance = result?.data || []
      console.log(`[ZK-SYNC] Got ${attendance.length} punch records`)
    } finally {
      try { await zk.disconnect() } catch {}
    }

    if (attendance.length === 0) {
      return NextResponse.json({ success: true, synced: 0, message: 'No records on device.' })
    }

    // Map ZK attendance records to RawPunchLog
    // ZK record: { deviceUserId: '1', attTime: Date, verifyMethod: number, inOutStatus: number }
    const rawPunches = attendance.map((record: any) => {
      // inOutStatus: 0=check-in, 1=check-out, 2=break-out, 3=break-in, 4=OT-in, 5=OT-out
      let punchType: string | null = null
      if (record.inOutStatus === 0) punchType = 'IN'
      else if (record.inOutStatus === 1) punchType = 'OUT'

      // attTime is already a Date in the machine's local time (IST)
      // Convert to UTC by subtracting 5:30 if needed
      const ts = record.attTime instanceof Date ? record.attTime : new Date(record.attTime)

      return {
        deviceUserId: String(record.deviceUserId),
        timestamp: ts,
        punchType,
        source: `zk-sync:${ip}`,
        processed: false
      }
    })

    // Batch insert (skip duplicates on same device+timestamp)
    const inserted = await prisma.rawPunchLog.createMany({
      data: rawPunches,
      skipDuplicates: true
    })

    console.log(`[ZK-SYNC] Inserted ${inserted.count} new punch records`)

    // Process immediately
    await processPunches()

    return NextResponse.json({
      success: true,
      fetched: attendance.length,
      synced: inserted.count,
      message: `Synced ${inserted.count} new punches from ${ip}`
    })
  } catch (error: any) {
    console.error('[ZK-SYNC] Error:', error)
    return NextResponse.json({
      error: error.message || 'Sync failed',
      details: 'Check that the machine IP is reachable and port 4370 is open.'
    }, { status: 500 })
  }
}

/**
 * GET /api/biometric/sync
 * Returns current connection config (no secrets)
 */
export async function GET() {
  return NextResponse.json({
    configured: !!process.env.BIOMETRIC_IP,
    ip: process.env.BIOMETRIC_IP || null,
    port: process.env.BIOMETRIC_PORT || '4370',
    hasCommKey: !!(process.env.BIOMETRIC_COMM_KEY && process.env.BIOMETRIC_COMM_KEY !== '0')
  })
}
