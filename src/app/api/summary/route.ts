import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateMonthlySummary } from '@/lib/engine'
import { CandidateType } from '@/generated/client'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const monthParam = searchParams.get('month')
  const yearParam = searchParams.get('year')

  if (!monthParam || !yearParam) {
    return NextResponse.json({ error: 'Missing month or year' }, { status: 400 })
  }

  const month1to12 = parseInt(monthParam, 10)
  const year = parseInt(yearParam, 10)
  const targetMonth0to11 = month1to12 - 1

  try {
    const candidates = await prisma.candidate.findMany({
      where: { active: true },
      orderBy: { name: 'asc' }
    })

    const start = new Date(Date.UTC(year, targetMonth0to11, 1))
    const end = new Date(Date.UTC(year, targetMonth0to11 + 1, 0, 23, 59, 59, 999))

    const logs = await prisma.attendanceLog.findMany({
      where: {
        date: { gte: start, lte: end }
      }
    })

    let prevMonth1to12 = month1to12 - 1
    let prevYear = year
    if (prevMonth1to12 === 0) {
      prevMonth1to12 = 12
      prevYear--
    }

    const prevBalances = await prisma.leaveBalance.findMany({
      where: {
        month: prevMonth1to12,
        year: prevYear
      }
    })

    const manualAdjustments = await prisma.manualLeaveAdjustment.findMany({
      where: {
        date: { gte: start, lte: end }
      }
    })

    const summaries = []

    for (const candidate of candidates) {
      const candidateLogs = logs.filter(l => l.candidateId === candidate.id)
      const prevBalance = prevBalances.find(b => b.candidateId === candidate.id)
      const candidateAdjustments = manualAdjustments.filter(m => m.candidateId === candidate.id)
      const previousCarryForward = prevBalance ? prevBalance.nextCarryForward : 0

      const summary = calculateMonthlySummary({
        candidate: {
          type: candidate.type as CandidateType,
          monthlySalary: candidate.ctcAnnual,
          joiningDate: candidate.joiningDate
        },
        logs: candidateLogs,
        targetMonth: targetMonth0to11,
        targetYear: year,
        previousCarryForward,
        manualAdjustments: candidateAdjustments
      })

      // Update current month's leave balance cache
      await prisma.leaveBalance.upsert({
        where: {
          candidateId_month_year: {
            candidateId: candidate.id,
            month: month1to12,
            year: year
          }
        },
        update: {
          carriedForward: previousCarryForward,
          monthlyQuota: summary.free_quota_this_month,
          availableLeaves: summary.available_quota,
          usedLeaves: summary.total_leave_units,
          lopDays: summary.excess_leaves,
          nextCarryForward: summary.next_carry_forward,
          freeQuota: summary.free_quota_this_month,
          excessLeaves: summary.excess_leaves,
          salaryDeduction: summary.excess_leaves * summary.per_day_salary
        },
        create: {
          candidateId: candidate.id,
          month: month1to12,
          year: year,
          carriedForward: previousCarryForward,
          monthlyQuota: summary.free_quota_this_month,
          availableLeaves: summary.available_quota,
          usedLeaves: summary.total_leave_units,
          lopDays: summary.excess_leaves,
          nextCarryForward: summary.next_carry_forward,
          freeQuota: summary.free_quota_this_month,
          excessLeaves: summary.excess_leaves,
          salaryDeduction: summary.excess_leaves * summary.per_day_salary
        }
      })

      summaries.push({
        candidate,
        summary,
        logs: candidateLogs
      })
    }

    return NextResponse.json(summaries)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to compute summary' }, { status: 500 })
  }
}
