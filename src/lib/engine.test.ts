import { describe, it, expect } from 'vitest'
import { classifyDay, calculateSaturdayCompliance, calculateMonthlySummary } from './engine'

describe('classifyDay', () => {
  it('returns HALF_DAY for missing punch', () => {
    expect(classifyDay(new Date(), null)).toBe('HALF_DAY')
    expect(classifyDay(null, new Date())).toBe('HALF_DAY')
    expect(classifyDay(null, null)).toBe('HALF_DAY')
  })

  it('returns FULL_DAY_LEAVE if worked < 4 hours', () => {
    // Note: Since we use getIstTime inside which adds 5.5 hours, let's just create UTC dates.
    // 9:00 AM IST is 3:30 AM UTC.
    const login = new Date(Date.UTC(2026, 5, 1, 3, 30))
    const logout = new Date(Date.UTC(2026, 5, 1, 7, 0)) // 3.5 hours later
    expect(classifyDay(login, logout)).toBe('FULL_DAY_LEAVE')
  })

  it('returns HALF_DAY if worked < 7 hours', () => {
    const login = new Date(Date.UTC(2026, 5, 1, 3, 30)) // 9:00 AM IST
    const logout = new Date(Date.UTC(2026, 5, 1, 9, 30)) // 6 hours later (3:00 PM IST)
    expect(classifyDay(login, logout)).toBe('HALF_DAY')
  })

  it('returns FULL_DAY_PRESENT for normal 9 to 6', () => {
    const login = new Date(Date.UTC(2026, 5, 1, 3, 30)) // 9:00 AM IST
    const logout = new Date(Date.UTC(2026, 5, 1, 12, 30)) // 6:00 PM IST
    expect(classifyDay(login, logout)).toBe('FULL_DAY_PRESENT')
  })

  it('returns FULL_DAY_PRESENT_LATE for login > 10:30 AM IST', () => {
    const login = new Date(Date.UTC(2026, 5, 1, 5, 15)) // 10:45 AM IST
    const logout = new Date(Date.UTC(2026, 5, 1, 13, 15)) // 8 hours later (6:45 PM IST)
    expect(classifyDay(login, logout)).toBe('FULL_DAY_PRESENT_LATE')
  })

  it('returns HALF_DAY for login > 11:30 AM IST even if > 7 hours worked', () => {
    const login = new Date(Date.UTC(2026, 5, 1, 6, 15)) // 11:45 AM IST
    const logout = new Date(Date.UTC(2026, 5, 1, 15, 15)) // 9 hours later (8:45 PM IST)
    expect(classifyDay(login, logout)).toBe('HALF_DAY')
  })
})

describe('calculateSaturdayCompliance', () => {
  it('penalizes both groups if no saturdays attended', () => {
    const logs: { date: Date | string }[] = []
    const res = calculateSaturdayCompliance(logs, 2026, 5) // June 2026
    expect(res.penalty).toBe(2)
  })

  it('penalizes 1 group if only 1 attended', () => {
    // June 6th 2026 is Group A
    const logs = [
      { date: new Date(Date.UTC(2026, 5, 6)), loginTime: new Date(), logoutTime: new Date() }
    ]
    const res = calculateSaturdayCompliance(logs, 2026, 5)
    expect(res.penalty).toBe(1)
  })

  it('penalizes 0 if both groups attended', () => {
    // June 6th (A) and June 20th (B)
    const logs = [
      { date: new Date(Date.UTC(2026, 5, 6)), loginTime: new Date(), logoutTime: new Date() },
      { date: new Date(Date.UTC(2026, 5, 20)), loginTime: new Date(), logoutTime: new Date() }
    ]
    const res = calculateSaturdayCompliance(logs, 2026, 5)
    expect(res.penalty).toBe(0)
  })
})

describe('calculateMonthlySummary', () => {
  it('calculates full month perfect attendance', () => {
    const candidate = { type: 'FULL_TIME' as const, monthlySalary: 50000, joiningDate: new Date(Date.UTC(2023, 0, 1)) }
    const targetYear = 2026
    const targetMonth = 5 // June

    const logs = []
    // 22 weekdays in June 2026
    for (let day = 1; day <= 30; day++) {
      const d = new Date(Date.UTC(2026, 5, day))
      const dayOfWeek = d.getUTCDay()
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        logs.push({
          date: d,
          loginTime: new Date(Date.UTC(2026, 5, day, 3, 30)), // 9 AM IST
          logoutTime: new Date(Date.UTC(2026, 5, day, 12, 30)), // 6 PM IST
        })
      }
    }
    // Plus 2 compliance saturdays
    logs.push({
      date: new Date(Date.UTC(2026, 5, 6)),
      loginTime: new Date(Date.UTC(2026, 5, 6, 3, 30)),
      logoutTime: new Date(Date.UTC(2026, 5, 6, 12, 30)),
    })
    logs.push({
      date: new Date(Date.UTC(2026, 5, 20)),
      loginTime: new Date(Date.UTC(2026, 5, 20, 3, 30)),
      logoutTime: new Date(Date.UTC(2026, 5, 20, 12, 30)),
    })

    const res = calculateMonthlySummary({
      candidate,
      logs,
      previousCarryForward: 1, // bringing 1 from last month
      targetYear,
      targetMonth,
    })

    expect(res.total_leave_units).toBe(0) // No leaves
    expect(res.available_quota).toBe(3) // 1 carry forward + 2 quota
    expect(res.excess_leaves).toBe(0)
    expect(res.next_carry_forward).toBe(3)
    expect(res.working_days_in_month).toBe(24) // 22 weekdays + 2 compliance saturdays
    expect(res.final_salary).toBe(50000)
    expect(res.days_present).toBe(24)
  })

  it('calculates deductions for excess leaves', () => {
    const candidate = { type: 'INTERN' as const, monthlySalary: 24000, joiningDate: new Date(Date.UTC(2023, 0, 1)) }
    const res = calculateMonthlySummary({
      candidate,
      logs: [], // No attendance at all
      previousCarryForward: 0,
      targetYear: 2026,
      targetMonth: 5,
      config: { fullTimeQuota: 2, internQuota: 1 }
    })

    // 22 weekdays + 2 penalty for no saturdays
    expect(res.total_leave_units).toBe(24)
    expect(res.available_quota).toBe(1) // intern gets 1
    expect(res.excess_leaves).toBe(23)
    expect(res.next_carry_forward).toBe(0)
    expect(res.working_days_in_month).toBe(24)
    const perDay = 24000 / 25 // 960
    // They missed everything. 24 days total.
    // Excess = 23. Deduction = 22080.
    // Final salary = 24000 - 22080 = 1920.
    expect(res.final_salary).toBe(1920)
  })
})
