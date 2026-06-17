import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { invalidateDashboardCache } from '@/lib/redis'
import { closeMonth } from '@/lib/jobs/closeMonth'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { candidateId, date, credit, debit, description } = body

    if (!candidateId || !date || credit === undefined || debit === undefined || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const adjustment = await prisma.manualLeaveAdjustment.create({
      data: {
        candidateId,
        date: new Date(date),
        credit: parseFloat(credit),
        debit: parseFloat(debit),
        description
      }
    })

    await invalidateDashboardCache()

    // Trigger incremental summary update in database
    const adjDate = new Date(date)
    await closeMonth(candidateId, adjDate.getUTCMonth() + 1, adjDate.getUTCFullYear(), true)

    return NextResponse.json({ success: true, adjustment })
  } catch (error: any) {
    console.error('Error creating manual adjustment:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

