import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processPunches } from '@/lib/jobs/ingestionProcessor'

export async function POST(request: Request) {
  try {
    const data = await request.json()
    // eSSL webhook payload format expected: { punches: [{ deviceUserId: '1', timestamp: '2026-06-16T10:00:00Z', punchType: 'IN' }] }
    
    if (!data.punches || !Array.isArray(data.punches)) {
      return NextResponse.json({ error: 'Invalid payload format' }, { status: 400 })
    }

    const logsToCreate = data.punches.map((p: any) => ({
      deviceUserId: p.deviceUserId,
      timestamp: new Date(p.timestamp),
      punchType: p.punchType || null,
      source: 'device_push',
      processed: false
    }))

    // Batch insert
    await prisma.rawPunchLog.createMany({
      data: logsToCreate
    })

    // Spec: "The webhook endpoint's job is to write to RawPunchLog and return 200 immediately; processing happens asynchronously."
    // Trigger background processing asynchronously without awaiting it
    processPunches().catch(console.error)

    return NextResponse.json({ success: true, count: logsToCreate.length }, { status: 200 })
  } catch (error) {
    console.error('Webhook Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
