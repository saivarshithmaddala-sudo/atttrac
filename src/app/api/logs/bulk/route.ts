import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { classifyDay } from '@/lib/engine'
import { invalidateDashboardCache } from '@/lib/redis'

export async function POST(request: Request) {
  try {
    const data = await request.json()
    // Expects: { logs: Array<{ candidateId: string, date: string, loginTime: string | null, logoutTime: string | null }> }
    
    if (!data.logs || !Array.isArray(data.logs)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const operations = data.logs.map((log: any) => {
      const date = new Date(log.date)
      const login = log.loginTime ? new Date(log.loginTime) : null
      const logout = log.logoutTime ? new Date(log.logoutTime) : null
      const status = classifyDay(login, logout)

      return prisma.attendanceLog.upsert({
        where: {
          candidateId_date: {
            candidateId: log.candidateId,
            date: date
          }
        },
        update: {
          loginTime: login,
          logoutTime: logout,
          status: status
        },
        create: {
          candidateId: log.candidateId,
          date: date,
          loginTime: login,
          logoutTime: logout,
          status: status
        }
      })
    })

    await prisma.$transaction(operations)

    // Invalidate caches
    await invalidateDashboardCache()

    return NextResponse.json({ success: true, count: operations.length }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process bulk upload' }, { status: 500 })
  }
}
