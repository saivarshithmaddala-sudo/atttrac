
export type CandidateType = 'FULL_TIME' | 'INTERN'
export type DayStatus = 'FULL_DAY_PRESENT' | 'FULL_DAY_PRESENT_LATE' | 'HALF_DAY' | 'FULL_DAY_LEAVE' | 'WEEKEND_OFF' | 'HOLIDAY'

export function classifyDay(loginTime: Date | null, logoutTime: Date | null): DayStatus {
  if (!loginTime || !logoutTime) {
    return 'HALF_DAY'
  }

  // Use raw milliseconds to calculate worked hours reliably
  const workedHours = (logoutTime.getTime() - loginTime.getTime()) / (1000 * 60 * 60)

  if (workedHours < 4) {
    return 'FULL_DAY_LEAVE'
  }
  if (workedHours < 7) {
    return 'HALF_DAY'
  }

  // Time-based late logic. We need IST.
  // We can add 5.5 hours to the UTC time, then extract hours and minutes as if it were UTC.
  const istDate = new Date(loginTime.getTime() + (5.5 * 60 * 60 * 1000))
  const timeInMinutes = istDate.getUTCHours() * 60 + istDate.getUTCMinutes()

  if (timeInMinutes > 11 * 60 + 30) {
    return 'HALF_DAY'
  }
  if (timeInMinutes > 10 * 60 + 30) {
    return 'FULL_DAY_PRESENT_LATE'
  }

  return 'FULL_DAY_PRESENT'
}

export function getMonthlyQuota(month: number, type: CandidateType): number {
  if (type === 'INTERN') {
    // Interns: 1 paid leave day every month
    return 1.0
  }

  // Full-Time monthly leave entitlement (alternating by month):
  // Jan=2.5, Feb=2, Mar=2.5, Apr=2, May=2.5, Jun=2,
  // Jul=2.5, Aug=2, Sep=2.5, Oct=2, Nov=2.5, Dec=2
  const fullTimeQuota: Record<number, number> = {
    1: 2.5,  // January
    2: 2.0,  // February
    3: 2.5,  // March
    4: 2.0,  // April
    5: 2.5,  // May
    6: 2.0,  // June
    7: 2.5,  // July
    8: 2.0,  // August
    9: 2.5,  // September
    10: 2.0, // October
    11: 2.5, // November
    12: 2.0  // December
  }
  return fullTimeQuota[month] ?? 2.0
}

export function calculateLeaveBalance(
  month: number,
  candidateType: CandidateType,
  previousNextCarryForward: number,
  usedLeaves: number,
  manualCredits: number = 0
) {
  const quota = getMonthlyQuota(month, candidateType)
  const availableLeaves = previousNextCarryForward + quota + manualCredits

  let lopDays = 0
  let nextCarryForward = 0

  if (usedLeaves <= availableLeaves) {
    lopDays = 0
    nextCarryForward = availableLeaves - usedLeaves
  } else {
    lopDays = usedLeaves - availableLeaves
    nextCarryForward = 0
  }

  return {
    monthlyQuota: quota,
    carriedForward: previousNextCarryForward,
    availableLeaves,
    usedLeaves,
    lopDays,
    nextCarryForward
  }
}

export function calculatePayslip(
  month: number,
  year: number,
  ctcAnnual: number,
  lopDays: number,
  daysPresent: number,
  daysOnLeave: number,
  type: CandidateType = 'FULL_TIME'
) {
  // ctcAnnual stores the MONTHLY salary for both interns and full-timers
  // Intern: ₹7,500/month | Full-Time: ₹36,000/month
  const grossMonthly = ctcAnnual
  
  // Per-day rate = monthly salary / 24 working days
  // Full-Time: 36000/24 = ₹1,500/day | Intern: 7500/24 = ₹312.50/day
  const perDayRate = grossMonthly / 24
  
  const lopDeduction = perDayRate * lopDays
  const netPay = Math.max(0, grossMonthly - lopDeduction)

  return {
    ctcAnnual,
    grossMonthly,
    perDayRate,
    lopDays,
    lopDeduction,
    netPay,
    daysPresent,
    daysOnLeave
  }
}

export function calculateUsedLeaves(logs: { status: DayStatus }[]) {
  let used = 0
  for (const log of logs) {
    if (log.status === 'FULL_DAY_LEAVE') used += 1
    else if (log.status === 'HALF_DAY') used += 0.5
  }
  return used
}

export function calculateSaturdayCompliance(
  logs: { date: Date | string }[],
  year: number,
  monthZeroIndexed: number
) {
  const saturdays: Date[] = []
  const daysInMonth = new Date(Date.UTC(year, monthZeroIndexed + 1, 0)).getUTCDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(Date.UTC(year, monthZeroIndexed, d))
    if (date.getUTCDay() === 6) {
      saturdays.push(date)
    }
  }

  const groupASat = saturdays[0]
  const groupBSat = saturdays[2]

  const hasLog = (targetDate: Date) => {
    return logs.some(log => {
      const logDate = new Date(log.date)
      return logDate.getUTCFullYear() === targetDate.getUTCFullYear() &&
             logDate.getUTCMonth() === targetDate.getUTCMonth() &&
             logDate.getUTCDate() === targetDate.getUTCDate()
    })
  }

  const missedSaturdays: string[] = []
  let penalty = 0

  if (groupASat && !hasLog(groupASat)) {
    penalty += 1
    missedSaturdays.push(groupASat.toISOString())
  }
  if (groupBSat && !hasLog(groupBSat)) {
    penalty += 1
    missedSaturdays.push(groupBSat.toISOString())
  }

  return {
    penalty,
    missedSaturdays
  }
}

export function calculateMonthlySummary({
  candidate,
  logs,
  previousCarryForward = 0,
  targetYear,
  targetMonth,
  config,
  manualAdjustments = []
}: {
  candidate: { type: CandidateType; monthlySalary?: number; ctcAnnual?: number; joiningDate?: Date | string };
  logs: {
    date: Date | string;
    status?: DayStatus | null;
    loginTime?: Date | string | null;
    logoutTime?: Date | string | null;
  }[];
  previousCarryForward?: number;
  targetYear: number;
  targetMonth: number;
  config?: { fullTimeQuota?: number; internQuota?: number };
  manualAdjustments?: { credit?: number; debit?: number }[];
}) {
  const daysInMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  
  const saturdays: Date[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(Date.UTC(targetYear, targetMonth, d))
    if (date.getUTCDay() === 6) {
      saturdays.push(date)
    }
  }
  const groupASat = saturdays[0]
  const groupBSat = saturdays[2]

  const manualCredits = manualAdjustments?.reduce((sum, m) => sum + (m.credit || 0), 0) || 0
  const manualDebits = manualAdjustments?.reduce((sum, m) => sum + (m.debit || 0), 0) || 0

  let working_days_in_month = 0
  let days_present = 0
  let total_leave_units = manualDebits
  const missed_saturdays: string[] = []

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(Date.UTC(targetYear, targetMonth, d))
    const dayOfWeek = date.getUTCDay()
    
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5
    const isComplianceSat = (groupASat && date.getUTCDate() === groupASat.getUTCDate()) || 
                             (groupBSat && date.getUTCDate() === groupBSat.getUTCDate())

    if (!isWeekday && !isComplianceSat) {
      continue
    }

    working_days_in_month++

    const log = logs.find(l => {
      const logDate = new Date(l.date)
      return logDate.getUTCFullYear() === targetYear &&
             logDate.getUTCMonth() === targetMonth &&
             logDate.getUTCDate() === d
    })

    if (log) {
      const status: DayStatus = log.status || classifyDay(
        log.loginTime ? new Date(log.loginTime) : null,
        log.logoutTime ? new Date(log.logoutTime) : null
      )

      if (status === 'FULL_DAY_PRESENT') {
        days_present += 1
      } else if (status === 'FULL_DAY_PRESENT_LATE') {
        days_present += 1
        total_leave_units += 0.5
      } else if (status === 'HALF_DAY') {
        days_present += 0.5
        total_leave_units += 0.5
      } else if (status === 'FULL_DAY_LEAVE') {
        total_leave_units += 1.0
      } else if (status === 'HOLIDAY') {
        days_present += 1
      }
    } else {
      total_leave_units += 1.0
      if (isComplianceSat) {
        missed_saturdays.push(date.toISOString())
      }
    }
  }

  const free_quota_this_month = candidate.type === 'INTERN'
    ? (config?.internQuota ?? 1.0)
    : (config?.fullTimeQuota ?? getMonthlyQuota(targetMonth + 1, candidate.type))

  const available_quota = previousCarryForward + free_quota_this_month + manualCredits

  let excess_leaves = 0
  let next_carry_forward = 0

  if (total_leave_units <= available_quota) {
    excess_leaves = 0
    next_carry_forward = available_quota - total_leave_units
  } else {
    excess_leaves = total_leave_units - available_quota
    next_carry_forward = 0
  }

  // ctcAnnual stores the MONTHLY salary; per-day = monthly / 24
  const grossSalary = candidate.monthlySalary || (candidate.ctcAnnual ? candidate.ctcAnnual : 0)
  const per_day_salary = grossSalary / 24
  const salary_deduction = excess_leaves * per_day_salary
  const final_salary = Math.max(0, grossSalary - salary_deduction)

  return {
    carried_forward: previousCarryForward,
    free_quota_this_month,
    available_quota,
    total_leave_units,
    excess_leaves,
    next_carry_forward,
    working_days_in_month,
    per_day_salary,
    final_salary,
    days_present,
    missed_saturdays
  }
}
