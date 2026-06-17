import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { invalidateDashboardCache } from '@/lib/redis'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const resolvedParams = await params
    const id = resolvedParams.id
    const data = await request.json()

    if (typeof data.active !== 'boolean') {
      return NextResponse.json({ error: 'Active field must be a boolean.' }, { status: 400 })
    }

    const candidate = await prisma.candidate.update({
      where: { id },
      data: { active: data.active }
    })

    // Invalidate dashboard cache
    await invalidateDashboardCache()

    return NextResponse.json(candidate)
  } catch (error) {
    console.error("PATCH /api/candidates/[id]/status ERROR:", error)
    return NextResponse.json({ error: 'Failed to update candidate status' }, { status: 500 })
  }
}
