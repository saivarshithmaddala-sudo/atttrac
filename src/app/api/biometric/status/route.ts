import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/biometric/status
 * Returns sync stats: total raw punches, processed count, unprocessed, exceptions (unmapped device IDs)
 */
export async function GET() {
  try {
    const [total, processed, unprocessed] = await Promise.all([
      prisma.rawPunchLog.count(),
      prisma.rawPunchLog.count({ where: { processed: true } }),
      prisma.rawPunchLog.count({ where: { processed: false } })
    ])

    // Find unprocessed punches with device IDs not mapped to any candidate
    const unprocessedPunches = await prisma.rawPunchLog.findMany({
      where: { processed: false },
      select: { deviceUserId: true, timestamp: true, source: true },
      orderBy: { timestamp: 'desc' },
      take: 100
    })

    const allMappedDeviceIds = (await prisma.candidate.findMany({
      select: { deviceUserId: true }
    })).map(c => c.deviceUserId)

    const unmappedGroups = new Map<string, { count: number; lastSeen: Date; source: string }>()
    for (const p of unprocessedPunches) {
      if (!allMappedDeviceIds.includes(p.deviceUserId)) {
        const existing = unmappedGroups.get(p.deviceUserId)
        if (!existing) {
          unmappedGroups.set(p.deviceUserId, { count: 1, lastSeen: p.timestamp, source: p.source })
        } else {
          existing.count++
          if (p.timestamp > existing.lastSeen) existing.lastSeen = p.timestamp
        }
      }
    }

    const exceptions = Array.from(unmappedGroups.entries()).map(([deviceUserId, info]) => ({
      deviceUserId,
      ...info
    }))

    // Recent syncs
    const recentSyncs = await prisma.rawPunchLog.findMany({
      where: { processed: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { source: true, createdAt: true }
    })

    return NextResponse.json({
      total,
      processed,
      unprocessed,
      exceptions,
      recentSyncs,
      machineConfig: {
        ip: process.env.BIOMETRIC_IP || null,
        port: process.env.BIOMETRIC_PORT || '4370',
        admsUrl: process.env.BIOMETRIC_IP
          ? `http://${process.env.NEXT_PUBLIC_APP_URL || 'YOUR_SERVER_IP:3000'}/api/biometric/adms`
          : null
      }
    })
  } catch (error) {
    console.error('[BIO-STATUS]', error)
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
  }
}
