import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { invalidateDashboardCache } from '@/lib/redis'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const activeParam = url.searchParams.get('active')
    const pageParam = url.searchParams.get('page')
    const limitParam = url.searchParams.get('limit')
    const searchParam = url.searchParams.get('search')

    let where: any = {}
    if (activeParam === 'true') {
      where.active = true
    } else if (activeParam === 'false') {
      where.active = false
    }

    if (searchParam) {
      where.OR = [
        { name: { contains: searchParam, mode: 'insensitive' } },
        { aeId: { contains: searchParam, mode: 'insensitive' } }
      ]
    }

    if (pageParam || limitParam) {
      const page = parseInt(pageParam || '1', 10) || 1
      const limit = parseInt(limitParam || '10', 10) || 10
      const skip = (page - 1) * limit

      const [candidates, total] = await prisma.$transaction([
        prisma.candidate.findMany({
          where,
          orderBy: { name: 'asc' },
          skip,
          take: limit,
        }),
        prisma.candidate.count({ where })
      ])

      return NextResponse.json({
        candidates,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      })
    } else {
      const candidates = await prisma.candidate.findMany({
        where,
        orderBy: { name: 'asc' }
      })
      return NextResponse.json(candidates)
    }
  } catch (error) {
    console.error("GET /api/candidates ERROR:", error)
    return NextResponse.json({ error: 'Failed to fetch candidates' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
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

    // Uniqueness checks
    const existingAe = await prisma.candidate.findUnique({
      where: { aeId: data.aeId }
    })
    if (existingAe) {
      return NextResponse.json({ field: 'aeId', message: 'AE ID is already in use.' }, { status: 400 })
    }

    const existingDevice = await prisma.candidate.findUnique({
      where: { deviceUserId }
    })
    if (existingDevice) {
      return NextResponse.json({ field: 'deviceUserId', message: 'Device User ID is already in use.' }, { status: 400 })
    }

    const candidate = await prisma.candidate.create({
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
    
    return NextResponse.json(candidate, { status: 201 })
  } catch (error) {
    console.error("POST /api/candidates ERROR:", error)
    return NextResponse.json({ error: 'Failed to create candidate' }, { status: 500 })
  }
}
