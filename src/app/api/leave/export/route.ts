import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateUsedLeaves, calculateLeaveBalance, calculatePayslip, DayStatus } from '@/lib/engine'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const monthParam = searchParams.get('month')
  const yearParam = searchParams.get('year')

  if (!monthParam || !yearParam) {
    return NextResponse.json({ error: 'Missing month or year' }, { status: 400 })
  }

  const month = parseInt(monthParam, 10)
  const year = parseInt(yearParam, 10)

  try {
    const candidates = await prisma.candidate.findMany({
      where: { active: true },
      orderBy: { name: 'asc' }
    })

    const candidateIds = candidates.map(c => c.id)
    const startDate = new Date(Date.UTC(year, month - 1, 1))
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))

    // Run parallel database calls
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

    const csvHeaders = [
      'Employee ID',
      'AE Number',
      'Name',
      'Month',
      'Year',
      'Opening Balance',
      'Monthly Credit',
      'Leave Used',
      'Closing Balance',
      'LOP Days',
      'Salary Deduction'
    ].join(',')

    const csvRows = candidates.map(candidate => {
      const b = balances.find(x => x.candidateId === candidate.id)

      if (b) {
        return [
          b.candidateId,
          candidate.aeId,
          `"${candidate.name}"`,
          b.month,
          b.year,
          b.carriedForward,
          b.freeQuota,
          b.usedLeaves,
          b.nextCarryForward,
          b.lopDays,
          b.salaryDeduction
        ].join(',')
      } else {
        // Fallback computation in memory
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

        return [
          candidate.id,
          candidate.aeId,
          `"${candidate.name}"`,
          month,
          year,
          balanceResult.carriedForward,
          balanceResult.monthlyQuota,
          balanceResult.usedLeaves,
          balanceResult.nextCarryForward,
          balanceResult.lopDays,
          salaryDeduction
        ].join(',')
      }
    })

    const csvContent = [csvHeaders, ...csvRows].join('\n')

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="leave_report_${month}_${year}.csv"`
      }
    })
  } catch (error: any) {
    console.error('Error generating CSV:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
