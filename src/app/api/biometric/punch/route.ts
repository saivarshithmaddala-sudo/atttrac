import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { classifyDay } from '@/lib/engine'
import { invalidateDashboardCache } from '@/lib/redis'


export async function POST(request: Request) {
  try {
    const data = await request.json()
    const { aeId, timestamp, status } = data

    if (!aeId || !timestamp || status === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const candidate = await prisma.candidate.findUnique({
      where: { aeId }
    })

    if (!candidate || !candidate.active) {
      return NextResponse.json({ error: 'Candidate not found or inactive' }, { status: 404 })
    }

    const punchTime = new Date(timestamp)
    // Truncate to midnight UTC
    const date = new Date(Date.UTC(punchTime.getUTCFullYear(), punchTime.getUTCMonth(), punchTime.getUTCDate()))

    const isCheckIn = status === 'IN' || status === '0' || status === 0
    const isCheckOut = status === 'OUT' || status === '1' || status === 1

    if (!isCheckIn && !isCheckOut) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const existingLog = await prisma.attendanceLog.findUnique({
      where: {
        candidateId_date: {
          candidateId: candidate.id,
          date
        }
      }
    })

    const nextLogin = existingLog
      ? (isCheckIn ? punchTime : existingLog.loginTime)
      : (isCheckIn ? punchTime : null)

    const nextLogout = existingLog
      ? (isCheckOut ? punchTime : existingLog.logoutTime)
      : (isCheckOut ? punchTime : null)

    const logStatus = classifyDay(nextLogin, nextLogout)

    if (existingLog) {
      await prisma.attendanceLog.update({
        where: { id: existingLog.id },
        data: {
          loginTime: nextLogin,
          logoutTime: nextLogout,
          status: logStatus
        }
      })
    } else {
      await prisma.attendanceLog.create({
        data: {
          candidateId: candidate.id,
          date,
          loginTime: nextLogin,
          logoutTime: nextLogout,
          status: logStatus
        }
      })
    }

    await invalidateDashboardCache()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Biometric Webhook Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

