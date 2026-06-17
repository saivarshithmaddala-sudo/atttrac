import { prisma } from '@/lib/prisma'
import { calculateUsedLeaves, calculateLeaveBalance, calculatePayslip, DayStatus } from '@/lib/engine'

// Closes a specific month for a candidate, and triggers a cascade for subsequent months if needed.
export async function closeMonth(candidateId: string, targetMonth: number, targetYear: number, cascade: boolean = true) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId }
  })
  if (!candidate) return

  // 1. Get prior month's nextCarryForward
  let priorMonth = targetMonth - 1
  let priorYear = targetYear
  if (priorMonth === 0) {
    priorMonth = 12
    priorYear -= 1
  }

  const priorBalance = await prisma.leaveBalance.findUnique({
    where: {
      candidateId_month_year: {
        candidateId,
        month: priorMonth,
        year: priorYear
      }
    }
  })

  const previousCarryForward = priorBalance ? priorBalance.nextCarryForward : 0

  // 2. Compute usedLeaves for this month
  const startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1))
  const endDate = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999))

  const logs = await prisma.attendanceLog.findMany({
    where: {
      candidateId,
      date: {
        gte: startDate,
        lte: endDate
      }
    }
  })

  // Retrieve manual adjustments
  const manualAdjustments = await prisma.manualLeaveAdjustment.findMany({
    where: {
      candidateId,
      date: {
        gte: startDate,
        lte: endDate
      }
    }
  })

  const manualCredits = manualAdjustments.reduce((sum, m) => sum + (m.credit || 0), 0)
  const manualDebits = manualAdjustments.reduce((sum, m) => sum + (m.debit || 0), 0)

  // Cast prisma generated types to our literal type
  let usedLeaves = calculateUsedLeaves(logs.map(l => ({ status: l.status as DayStatus })))

  const daysInMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate()
  const now = new Date()
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const joinUTC = new Date(Date.UTC(new Date(candidate.joiningDate).getUTCFullYear(), new Date(candidate.joiningDate).getUTCMonth(), new Date(candidate.joiningDate).getUTCDate()))

  const sats = []
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(Date.UTC(targetYear, targetMonth - 1, d))
    if (date.getUTCDay() === 6) {
      sats.push(d)
    }
  }

  let missingDays = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(Date.UTC(targetYear, targetMonth - 1, d))
    
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
    const d1 = new Date(Date.UTC(targetYear, targetMonth - 1, sat1Day))
    const d2 = new Date(Date.UTC(targetYear, targetMonth - 1, sat2Day))
    
    // If both Saturdays are in the future, don't penalize yet
    if (d1.getTime() > todayUTC.getTime() && d2.getTime() > todayUTC.getTime()) return

    const isD1Eligible = d1.getTime() >= joinUTC.getTime()
    const isD2Eligible = d2.getTime() >= joinUTC.getTime()

    if (!isD1Eligible && !isD2Eligible) return

    const hasD1Log = logs.some(l => new Date(l.date).getUTCDate() === sat1Day)
    const hasD2Log = logs.some(l => new Date(l.date).getUTCDate() === sat2Day)

    if (isD1Eligible && isD2Eligible) {
      // If one of them is in the future and has no log, candidate still has a chance to work it, so don't penalize yet
      if (d1.getTime() > todayUTC.getTime() && !hasD1Log) return
      if (d2.getTime() > todayUTC.getTime() && !hasD2Log) return

      if (!hasD1Log && !hasD2Log) missingDays += 1
    } else if (!isD1Eligible && isD2Eligible) {
      // If the only eligible Saturday is in the future, don't penalize yet
      if (d2.getTime() > todayUTC.getTime()) return
      if (!hasD2Log) missingDays += 1
    }
  }

  if (sats.length >= 2) checkGroup(sats[0], sats[1])
  if (sats.length >= 4) checkGroup(sats[2], sats[3])

  usedLeaves += missingDays + manualDebits
  
  // 3. Compute Leave Balance using Pure Engine Function
  const balanceResult = calculateLeaveBalance(targetMonth, candidate.type, previousCarryForward, usedLeaves, manualCredits)

  // 4. Compute Payslip
  const daysPresent = logs.filter(l => l.status === 'FULL_DAY_PRESENT' || l.status === 'FULL_DAY_PRESENT_LATE').length
  // Half-day counts as 0.5 present
  const halfDays = logs.filter(l => l.status === 'HALF_DAY').length

  const payslipResult = calculatePayslip(
    targetMonth,
    targetYear,
    candidate.ctcAnnual,
    balanceResult.lopDays,
    daysPresent,
    balanceResult.usedLeaves,
    candidate.type as 'FULL_TIME' | 'INTERN'
  )

  const salaryDeduction = balanceResult.lopDays * payslipResult.perDayRate

  // Upsert Leave Balance
  const upsertedBalance = await prisma.leaveBalance.upsert({
    where: {
      candidateId_month_year: {
        candidateId,
        month: targetMonth,
        year: targetYear
      }
    },
    update: {
      monthlyQuota: balanceResult.monthlyQuota,
      carriedForward: balanceResult.carriedForward,
      availableLeaves: balanceResult.availableLeaves,
      usedLeaves: balanceResult.usedLeaves,
      lopDays: balanceResult.lopDays,
      nextCarryForward: balanceResult.nextCarryForward,
      freeQuota: balanceResult.monthlyQuota,
      excessLeaves: balanceResult.lopDays,
      salaryDeduction: salaryDeduction
    },
    create: {
      candidateId,
      month: targetMonth,
      year: targetYear,
      monthlyQuota: balanceResult.monthlyQuota,
      carriedForward: balanceResult.carriedForward,
      availableLeaves: balanceResult.availableLeaves,
      usedLeaves: balanceResult.usedLeaves,
      lopDays: balanceResult.lopDays,
      nextCarryForward: balanceResult.nextCarryForward,
      freeQuota: balanceResult.monthlyQuota,
      excessLeaves: balanceResult.lopDays,
      salaryDeduction: salaryDeduction
    }
  })

  // Net Pay Till Date: what the employee has ACTUALLY EARNED so far this month.
  // = (days present + half days × 0.5) × per-day rate
  // This updates daily as attendance is logged.
  const effectiveDaysPresent = daysPresent + halfDays * 0.5
  const netPayTillDate = Math.max(0, effectiveDaysPresent * payslipResult.perDayRate)

  await prisma.payslip.upsert({
    where: {
      candidateId_month_year: {
        candidateId,
        month: targetMonth,
        year: targetYear
      }
    },
    update: payslipResult,
    create: {
      candidateId,
      month: targetMonth,
      year: targetYear,
      ...payslipResult
    }
  })

  // 5. Cascade to subsequent months
  if (cascade) {
    const currentUTC = new Date()
    const currentMonth = currentUTC.getUTCMonth() + 1
    const currentYear = currentUTC.getUTCFullYear()

    // Are there subsequent months to cascade to?
    if (targetYear < currentYear || (targetYear === currentYear && targetMonth < currentMonth)) {
      let nextMonth = targetMonth + 1
      let nextYear = targetYear
      if (nextMonth === 13) {
        nextMonth = 1
        nextYear += 1
      }
      
      // Check if a balance already exists for the next month, if so, we MUST cascade
      const nextBalance = await prisma.leaveBalance.findUnique({
        where: {
          candidateId_month_year: { candidateId, month: nextMonth, year: nextYear }
        }
      })
      
      if (nextBalance || (nextYear === currentYear && nextMonth === currentMonth)) {
        // Cascade asynchronously
        closeMonth(candidateId, nextMonth, nextYear, true).catch(console.error)
      }
    }
  }

  return { balanceResult, payslipResult, netPayTillDate, logs }
}
