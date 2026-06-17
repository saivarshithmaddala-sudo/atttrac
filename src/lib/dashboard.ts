import { prisma } from '@/lib/prisma'
import { getCache, setCache } from '@/lib/redis'
import { calculateUsedLeaves, calculateLeaveBalance, calculatePayslip, DayStatus } from '@/lib/engine'
import { Candidate, AttendanceLog, ManualLeaveAdjustment, LeaveBalance } from '@/generated/client'

export interface CandidateMonthlySummary {
  candidate: Candidate;
  balance: {
    monthlyQuota: number;
    carriedForward: number;
    availableLeaves: number;
    usedLeaves: number;
    lopDays: number;
    nextCarryForward: number;
  };
  payslip: {
    ctcAnnual: number;
    grossMonthly: number;
    perDayRate: number;
    lopDays: number;
    lopDeduction: number;
    netPay: number;
    daysPresent: number;
    daysOnLeave: number;
  };
  netPayTillDate: number;
  status: 'Finalized' | 'Provisional';
  logs: AttendanceLog[];
}

function computeCandidateSummaryInMemory(
  candidate: Candidate,
  logs: AttendanceLog[],
  manualAdjustments: ManualLeaveAdjustment[],
  priorBalance: LeaveBalance | null,
  month: number,
  year: number,
  todayUTC: Date
) {
  const previousCarryForward = priorBalance ? priorBalance.nextCarryForward : 0

  const manualCredits = manualAdjustments.reduce((sum, m) => sum + (m.credit || 0), 0)
  const manualDebits = manualAdjustments.reduce((sum, m) => sum + (m.debit || 0), 0)

  // Cast prisma generated types to our literal type
  let usedLeaves = calculateUsedLeaves(logs.map(l => ({ status: l.status as DayStatus })))

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
    
    // Ignore future days
    if (date.getTime() > todayUTC.getTime()) continue
    // Ignore days before joining date
    if (date.getTime() < joinUTC.getTime()) continue

    const dayOfWeek = date.getUTCDay()
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5

    if (isWeekday) {
      const hasLog = logs.some(l => new Date(l.date).getUTCDate() === d)
      if (!hasLog) {
        missingDays += 1
      }
    }
  }

  const checkGroup = (sat1Day: number, sat2Day: number) => {
    const d1 = new Date(Date.UTC(year, month - 1, sat1Day))
    const d2 = new Date(Date.UTC(year, month - 1, sat2Day))
    
    // If both Saturdays are in the future, don't penalize yet
    if (d1.getTime() > todayUTC.getTime() && d2.getTime() > todayUTC.getTime()) return

    const isD1Eligible = d1.getTime() >= joinUTC.getTime()
    const isD2Eligible = d2.getTime() >= joinUTC.getTime()

    if (!isD1Eligible && !isD2Eligible) return

    const hasD1Log = logs.some(l => new Date(l.date).getUTCDate() === sat1Day)
    const hasD2Log = logs.some(l => new Date(l.date).getUTCDate() === sat2Day)

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

  const daysPresent = logs.filter(l => l.status === 'FULL_DAY_PRESENT' || l.status === 'FULL_DAY_PRESENT_LATE').length
  const halfDays = logs.filter(l => l.status === 'HALF_DAY').length

  const payslipResult = calculatePayslip(
    month,
    year,
    candidate.ctcAnnual,
    balanceResult.lopDays,
    daysPresent,
    balanceResult.usedLeaves,
    candidate.type as 'FULL_TIME' | 'INTERN'
  )

  const effectiveDaysPresent = daysPresent + halfDays * 0.5
  const netPayTillDate = Math.max(0, effectiveDaysPresent * payslipResult.perDayRate)

  return {
    balanceResult,
    payslipResult,
    netPayTillDate
  }
}

export async function getMonthlyData(month: number, year: number, workLocation?: 'OFFICE' | 'FIELD'): Promise<CandidateMonthlySummary[]> {
  const currentUTC = new Date()
  const currentMonth = currentUTC.getUTCMonth() + 1
  const currentYear = currentUTC.getUTCFullYear()

  const isCurrentMonth = (year === currentYear && month === currentMonth)

  const cacheKey = `dashboard:${month}:${year}:${workLocation || 'ALL'}`
  if (!isCurrentMonth) {
    const cached = await getCache<CandidateMonthlySummary[]>(cacheKey)
    if (cached) return cached
  }

  // Fetch all active candidates matching the workLocation filter
  const where: { active: boolean; workLocation?: 'OFFICE' | 'FIELD' } = { active: true }
  if (workLocation) {
    where.workLocation = workLocation
  }

  const candidates = await prisma.candidate.findMany({
    where
  })

  const candidateIds = candidates.map(c => c.id)

  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))

  // Run database queries in parallel using Promise.all to fetch batch data
  const [
    balances,
    payslips,
    logs,
    manualAdjustments,
    priorBalances
  ] = await Promise.all([
    prisma.leaveBalance.findMany({
      where: { month, year, candidateId: { in: candidateIds } }
    }),
    prisma.payslip.findMany({
      where: { month, year, candidateId: { in: candidateIds } }
    }),
    prisma.attendanceLog.findMany({
      where: { date: { gte: startDate, lte: endDate }, candidateId: { in: candidateIds } }
    }),
    prisma.manualLeaveAdjustment.findMany({
      where: { date: { gte: startDate, lte: endDate }, candidateId: { in: candidateIds } }
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
    })()
  ])

  const now = new Date()
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  const results: CandidateMonthlySummary[] = []

  for (const candidate of candidates) {
    const candidateLogs = logs.filter(l => l.candidateId === candidate.id)
    const candidateAdjustments = manualAdjustments.filter(m => m.candidateId === candidate.id)
    const priorBalance = priorBalances.find(b => b.candidateId === candidate.id) || null

    const isFinalized = (year < currentYear) || (year === currentYear && month < currentMonth)

    // For past finalized months, load directly from DB if both balance and payslip exist
    const candidateBalance = balances.find(b => b.candidateId === candidate.id)
    const candidatePayslip = payslips.find(p => p.candidateId === candidate.id)

    if (candidateBalance && candidatePayslip && !isCurrentMonth) {
      results.push({
        candidate,
        balance: {
          monthlyQuota: candidateBalance.monthlyQuota,
          carriedForward: candidateBalance.carriedForward,
          availableLeaves: candidateBalance.availableLeaves,
          usedLeaves: candidateBalance.usedLeaves,
          lopDays: candidateBalance.lopDays,
          nextCarryForward: candidateBalance.nextCarryForward
        },
        payslip: {
          ctcAnnual: candidatePayslip.ctcAnnual,
          grossMonthly: candidatePayslip.grossMonthly,
          perDayRate: candidatePayslip.perDayRate,
          lopDays: candidatePayslip.lopDays,
          lopDeduction: candidatePayslip.lopDeduction,
          netPay: candidatePayslip.netPay,
          daysPresent: candidatePayslip.daysPresent,
          daysOnLeave: candidatePayslip.daysOnLeave
        },
        netPayTillDate: candidatePayslip.netPay, // past months: netPayTillDate is final netPay
        status: 'Finalized',
        logs: candidateLogs
      })
    } else {
      // For current month or missing past records, compute on the fly in-memory (side-effect free)
      const computed = computeCandidateSummaryInMemory(
        candidate,
        candidateLogs,
        candidateAdjustments,
        priorBalance,
        month,
        year,
        todayUTC
      )

      results.push({
        candidate,
        balance: computed.balanceResult,
        payslip: computed.payslipResult,
        netPayTillDate: computed.netPayTillDate,
        status: isFinalized ? 'Finalized' : 'Provisional',
        logs: candidateLogs
      })
    }
  }

  // Only cache finalized (past) months
  if (!isCurrentMonth) {
    await setCache(cacheKey, results, 3600)
  }

  return results
}
