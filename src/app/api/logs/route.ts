import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { classifyDay } from '@/lib/engine'
import { invalidateDashboardCache } from '@/lib/redis'
import { closeMonth } from '@/lib/jobs/closeMonth'


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const candidateId = searchParams.get('candidateId')
  const month = searchParams.get('month')
  const year = searchParams.get('year')

  try {
    let whereClause: any = {}
    if (candidateId) whereClause.candidateId = candidateId
    if (month && year) {
      const start = new Date(Date.UTC(Number(year), Number(month), 1))
      const end = new Date(Date.UTC(Number(year), Number(month) + 1, 0, 23, 59, 59, 999))
      whereClause.date = {
        gte: start,
        lte: end
      }
    }

    const logs = await prisma.attendanceLog.findMany({
      where: whereClause,
      orderBy: { date: 'asc' }
    })
    return NextResponse.json(logs)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    // Upsert the log
    const date = new Date(data.date) // Should be UTC midnight
    const login = data.loginTime ? new Date(data.loginTime) : null
    const logout = data.logoutTime ? new Date(data.logoutTime) : null
    const status = data.status && data.status !== 'AUTO' ? data.status : classifyDay(login, logout)

    const log = await prisma.attendanceLog.upsert({
      where: {
        candidateId_date: {
          candidateId: data.candidateId,
          date: date
        }
      },
      update: {
        loginTime: login,
        logoutTime: logout,
        status: status,
      },
      create: {
        candidateId: data.candidateId,
        date: date,
        loginTime: login,
        logoutTime: logout,
        status: status,
      }
    })
    
    // Changing any log for a month should trigger recompute of LeaveBalance.
    // We can just return the log here, and let the client call the summary endpoint, or we can compute it now.
    // For V1, we'll let the summary endpoint do the compute on-the-fly.
    await invalidateDashboardCache()

    // Trigger incremental summary update in database
    const targetMonth = date.getUTCMonth() + 1
    const targetYear = date.getUTCFullYear()
    await closeMonth(data.candidateId, targetMonth, targetYear, true)

    return NextResponse.json(log, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create log' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const candidateId = searchParams.get('candidateId')
    const dateParam = searchParams.get('date')

    if (!candidateId || !dateParam) {
      return NextResponse.json({ error: 'Missing candidateId or date' }, { status: 400 })
    }

    const date = new Date(dateParam) // Should be UTC midnight

    // Deletes the log if it exists
    await prisma.attendanceLog.deleteMany({
      where: {
        candidateId,
        date
      }
    })

    await invalidateDashboardCache()

    // Trigger incremental summary update in database
    const targetMonth = date.getUTCMonth() + 1
    const targetYear = date.getUTCFullYear()
    await closeMonth(candidateId, targetMonth, targetYear, true)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete Attendance Log Error:', error)
    return NextResponse.json({ error: error.message || 'Failed to delete log' }, { status: 500 })
  }
}

