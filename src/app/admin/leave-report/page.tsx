import { prisma } from '@/lib/prisma'
import { calculateUsedLeaves, calculateLeaveBalance, calculatePayslip, DayStatus } from '@/lib/engine'
import { format } from 'date-fns'
import LeaveReport from '@/components/LeaveReport'

export const dynamic = 'force-dynamic'

export default async function LeaveReportPage({
  searchParams
}: {
  searchParams: Promise<{ month?: string; year?: string }> | { month?: string; year?: string }
}) {
  const resolvedParams = await searchParams
  const monthParam = resolvedParams.month
  const yearParam = resolvedParams.year

  if (!monthParam || !yearParam) {
    return (
      <div className="p-8 text-center text-red-500">
        Error: Missing month or year parameter.
      </div>
    )
  }

  const month = parseInt(monthParam, 10)
  const year = parseInt(yearParam, 10)

  // Fetch all active candidates
  const candidates = await prisma.candidate.findMany({
    where: { active: true },
    orderBy: { name: 'asc' }
  })

  const candidateIds = candidates.map(c => c.id)
  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))

  // Fetch all monthly metrics in parallel batch queries
  const [
    balances,
    priorBalances,
    logs,
    manualAdjustments
  ] = await Promise.all([
    prisma.leaveBalance.findMany({
      where: { month, year, candidateId: { in: candidateIds } }
    }),
    (async () => {
      let priorMonth = month - 1
      let priorYear = year
      if (priorMonth === 0) {
        priorMonth = 12
        priorYear -= 1
      }
      return prisma.leaveBalance.findMany({
        where: { month: priorMonth, year: priorYear, candidateId: { in: candidateIds } }
      })
    })(),
    prisma.attendanceLog.findMany({
      where: { date: { gte: startDate, lte: endDate }, candidateId: { in: candidateIds } }
    }),
    prisma.manualLeaveAdjustment.findMany({
      where: { date: { gte: startDate, lte: endDate }, candidateId: { in: candidateIds } }
    })
  ])

  const now = new Date()
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  // Compile final rows in memory (all items are serializable to Client Component)
  const rows = candidates.map(candidate => {
    const b = balances.find(x => x.candidateId === candidate.id)

    if (b) {
      return {
        candidateId: b.candidateId,
        aeId: candidate.aeId,
        name: candidate.name,
        type: candidate.type,
        carriedForward: b.carriedForward,
        freeQuota: b.freeQuota,
        usedLeaves: b.usedLeaves,
        nextCarryForward: b.nextCarryForward,
        lopDays: b.lopDays,
        salaryDeduction: b.salaryDeduction
      }
    } else {
      // In-memory fallback computation
      const priorBalance = priorBalances.find(pb => pb.candidateId === candidate.id)
      const previousCarryForward = priorBalance ? priorBalance.nextCarryForward : 0

      const candidateLogs = logs.filter(l => l.candidateId === candidate.id)
      const candidateAdjustments = manualAdjustments.filter(m => m.candidateId === candidate.id)
      const manualCredits = candidateAdjustments.reduce((sum, m) => sum + (m.credit || 0), 0)
      const manualDebits = candidateAdjustments.reduce((sum, m) => sum + (m.debit || 0), 0)

      let usedLeaves = calculateUsedLeaves(candidateLogs.map(l => ({ status: l.status as DayStatus })))

      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
      const joinUTC = new Date(Date.UTC(new Date(candidate.joiningDate).getUTCFullYear(), new Date(candidate.joiningDate).getUTCMonth(), new Date(candidate.joiningDate).getUTCDate()))

      const sats = []
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(Date.UTC(year, month - 1, d))
        if (date.getUTCDay() === 6) {
          sats.push(d)
        }
      }

      let missingDays = 0
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(Date.UTC(year, month - 1, d))
        
        if (date.getTime() > todayUTC.getTime()) continue
        if (date.getTime() < joinUTC.getTime()) continue

        const dayOfWeek = date.getUTCDay()
        const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5

        if (isWeekday) {
          const hasLog = candidateLogs.some(l => new Date(l.date).getUTCDate() === d)
          if (!hasLog) {
            missingDays += 1
          }
        }
      }

      const checkGroup = (sat1Day: number, sat2Day: number) => {
        const d1 = new Date(Date.UTC(year, month - 1, sat1Day))
        const d2 = new Date(Date.UTC(year, month - 1, sat2Day))
        
        if (d1.getTime() > todayUTC.getTime() && d2.getTime() > todayUTC.getTime()) return

        const isD1Eligible = d1.getTime() >= joinUTC.getTime()
        const isD2Eligible = d2.getTime() >= joinUTC.getTime()

        if (!isD1Eligible && !isD2Eligible) return

        const hasD1Log = candidateLogs.some(l => new Date(l.date).getUTCDate() === sat1Day)
        const hasD2Log = candidateLogs.some(l => new Date(l.date).getUTCDate() === sat2Day)

        if (isD1Eligible && isD2Eligible) {
          if (d1.getTime() > todayUTC.getTime() && !hasD1Log) return
          if (d2.getTime() > todayUTC.getTime() && !hasD2Log) return

          if (!hasD1Log && !hasD2Log) missingDays += 1
        } else if (!isD1Eligible && isD2Eligible) {
          if (d2.getTime() > todayUTC.getTime()) return
          if (!hasD2Log) missingDays += 1
        }
      }

      if (sats.length >= 2) checkGroup(sats[0], sats[1])
      if (sats.length >= 4) checkGroup(sats[2], sats[3])

      usedLeaves += missingDays + manualDebits

      const balanceResult = calculateLeaveBalance(month, candidate.type, previousCarryForward, usedLeaves, manualCredits)

      const daysPresent = candidateLogs.filter(l => l.status === 'FULL_DAY_PRESENT' || l.status === 'FULL_DAY_PRESENT_LATE').length
      const payslipResult = calculatePayslip(
        month,
        year,
        candidate.ctcAnnual,
        balanceResult.lopDays,
        daysPresent,
        balanceResult.usedLeaves,
        candidate.type as 'FULL_TIME' | 'INTERN'
      )

      const salaryDeduction = balanceResult.lopDays * payslipResult.perDayRate

      return {
        candidateId: candidate.id,
        aeId: candidate.aeId,
        name: candidate.name,
        type: candidate.type,
        carriedForward: balanceResult.carriedForward,
        freeQuota: balanceResult.monthlyQuota,
        usedLeaves: balanceResult.usedLeaves,
        nextCarryForward: balanceResult.nextCarryForward,
        lopDays: balanceResult.lopDays,
        salaryDeduction
      }
    }
  })

  const reportDateStr = format(new Date(year, month - 1), 'MMMM yyyy')
  const printTitle = `Leave_Report_${reportDateStr.replace(/\s+/g, '_')}`

  return (
    <LeaveReport rows={rows} reportDateStr={reportDateStr} printTitle={printTitle} />
  )
}
