import { prisma } from '@/lib/prisma'
import { classifyDay } from '@/lib/engine'
import { invalidateDashboardCache } from '@/lib/redis'
import { closeMonth } from '@/lib/jobs/closeMonth'

export async function processPunches() {
  // 1. Fetch unprocessed punches
  const rawPunches = await prisma.rawPunchLog.findMany({
    where: { processed: false },
    orderBy: { timestamp: 'asc' }
  })

  if (rawPunches.length === 0) return

  // Group by deviceUserId and date string (YYYY-MM-DD UTC)
  const grouped = new Map<string, typeof rawPunches>()

  for (const punch of rawPunches) {
    const dateStr = punch.timestamp.toISOString().split('T')[0]
    const key = `${punch.deviceUserId}|${dateStr}`
    
    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key)!.push(punch)
  }

  // Find candidates for the mapped devices
  const deviceUserIds = [...new Set(rawPunches.map(p => p.deviceUserId))]
  const candidates = await prisma.candidate.findMany({
    where: { deviceUserId: { in: deviceUserIds } }
  })
  const candidateMap = new Map(candidates.map(c => [c.deviceUserId, c]))

  const processedIds: string[] = []

  for (const [key, punches] of grouped.entries()) {
    const [deviceUserId, dateStr] = key.split('|')
    const candidate = candidateMap.get(deviceUserId)

    if (!candidate) {
      // Unmapped device IDs stay processed=false, or we can mark them but store them elsewhere?
      // Spec: "Unmapped device IDs go to an exceptions queue (visible in admin UI) instead of silently dropping."
      // Leaving them processed=false makes them queryable as exceptions.
      continue
    }

    // Determine login/logout
    let loginTime: Date | null = null
    let logoutTime: Date | null = null

    const ins = punches.filter(p => p.punchType === 'IN')
    const outs = punches.filter(p => p.punchType === 'OUT')

    if (ins.length > 0 || outs.length > 0) {
      if (ins.length > 0) loginTime = ins[0].timestamp
      if (outs.length > 0) logoutTime = outs[outs.length - 1].timestamp
    } else {
      // eSSL default earliest/latest
      loginTime = punches[0].timestamp
      logoutTime = punches[punches.length - 1].timestamp
      if (loginTime.getTime() === logoutTime.getTime()) {
        logoutTime = null // only one punch
      }
    }

    const status = classifyDay(loginTime, logoutTime)

    // Upsert AttendanceLog
    await prisma.attendanceLog.upsert({
      where: {
        candidateId_date: {
          candidateId: candidate.id,
          date: new Date(`${dateStr}T00:00:00Z`)
        }
      },
      update: {
        loginTime,
        logoutTime,
        status
      },
      create: {
        candidateId: candidate.id,
        date: new Date(`${dateStr}T00:00:00Z`),
        loginTime,
        logoutTime,
        status
      }
    })

    // Invalidate dashboard cache
    await invalidateDashboardCache()

    // Incrementally precompute leave balances and payslips for this candidate
    const dt = new Date(`${dateStr}T00:00:00Z`)
    await closeMonth(candidate.id, dt.getUTCMonth() + 1, dt.getUTCFullYear(), true)

    processedIds.push(...punches.map(p => p.id))
  }

  if (processedIds.length > 0) {
    // Mark as processed
    await prisma.rawPunchLog.updateMany({
      where: { id: { in: processedIds } },
      data: { processed: true }
    })
  }
}
