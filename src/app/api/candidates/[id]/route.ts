import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { invalidateDashboardCache } from '@/lib/redis'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const resolvedParams = await params
    const id = resolvedParams.id
    const data = await request.json()

    // Validation
    if (!data.aeId || data.aeId.trim() === '') {
      return NextResponse.json({ field: 'aeId', message: 'AE ID is required.' }, { status: 400 })
    }
    if (!data.name || data.name.trim() === '') {
      return NextResponse.json({ field: 'name', message: 'Name is required.' }, { status: 400 })
    }
    if (isNaN(Number(data.ctcAnnual)) || Number(data.ctcAnnual) <= 0) {
      return NextResponse.json({ field: 'ctcAnnual', message: 'Salary / Stipend must be a positive number.' }, { status: 400 })
    }
    if (!data.joiningDate || isNaN(Date.parse(data.joiningDate))) {
      return NextResponse.json({ field: 'joiningDate', message: 'Valid joining date is required.' }, { status: 400 })
    }

    const deviceUserId = (data.deviceUserId || data.aeId).trim()
    if (deviceUserId === '') {
      return NextResponse.json({ field: 'deviceUserId', message: 'Device User ID is required.' }, { status: 400 })
    }

    // Uniqueness checks (excluding current candidate)
    const existingAe = await prisma.candidate.findFirst({
      where: {
        aeId: data.aeId.trim(),
        NOT: { id }
      }
    })
    if (existingAe) {
      return NextResponse.json({ field: 'aeId', message: 'AE ID is already in use.' }, { status: 400 })
    }

    const existingDevice = await prisma.candidate.findFirst({
      where: {
        deviceUserId,
        NOT: { id }
      }
    })
    if (existingDevice) {
      return NextResponse.json({ field: 'deviceUserId', message: 'Device User ID is already in use.' }, { status: 400 })
    }

    const candidate = await prisma.candidate.update({
      where: { id },
      data: {
        aeId: data.aeId.trim(),
        name: data.name.trim(),
        type: data.type,
        workLocation: data.workLocation || 'OFFICE',
        ctcAnnual: Number(data.ctcAnnual),
        joiningDate: new Date(data.joiningDate),
        deviceUserId,
        photoUrl: data.photoUrl || null,
        active: data.active ?? true,
        workingSaturdays: Array.isArray(data.workingSaturdays) ? data.workingSaturdays.join(',') : data.workingSaturdays || "1,3",
      }
    })

    // Invalidate dashboard cache
    await invalidateDashboardCache()

    return NextResponse.json(candidate)
  } catch (error) {
    console.error("PUT /api/candidates/[id] ERROR:", error)
    return NextResponse.json({ error: 'Failed to update candidate' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const resolvedParams = await params
    const id = resolvedParams.id

    const url = new URL(request.url)
    const force = url.searchParams.get('force') === 'true'

    // Check if candidate exists first to avoid P2025 errors
    const existing = await prisma.candidate.findUnique({ where: { id } })
    if (!existing) {
      // If it doesn't exist, we consider it "deleted" (idempotent)
      await invalidateDashboardCache()
      return NextResponse.json({ success: true })
    }

    // Check history count
    const [attendanceCount, leaveCount, payslipCount] = await Promise.all([
      prisma.attendanceLog.count({ where: { candidateId: id } }),
      prisma.leaveBalance.count({ where: { candidateId: id } }),
      prisma.payslip.count({ where: { candidateId: id } })
    ])

    const totalHistory = attendanceCount + leaveCount + payslipCount

    if (totalHistory > 0 && !force) {
      return NextResponse.json({
        error: 'HAS_HISTORY',
        message: `Candidate has historical records (${attendanceCount} attendance logs, ${leaveCount} leave balances, ${payslipCount} payslips).`
      }, { status: 409 })
    }

    // Cascade delete in database transaction
    await prisma.$transaction([
      prisma.attendanceLog.deleteMany({ where: { candidateId: id } }),
      prisma.leaveBalance.deleteMany({ where: { candidateId: id } }),
      prisma.payslip.deleteMany({ where: { candidateId: id } }),
      prisma.manualLeaveAdjustment.deleteMany({ where: { candidateId: id } }),
      prisma.candidate.delete({ where: { id } })
    ])

    // Invalidate dashboard cache
    await invalidateDashboardCache()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/candidates/[id] ERROR:", error)
    return NextResponse.json({ error: 'Failed to delete candidate' }, { status: 500 })
  }
}

