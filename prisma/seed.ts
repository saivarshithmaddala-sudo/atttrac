import { PrismaClient, CandidateType, DayStatus } from '../src/generated/client'
import { addDays, setHours, setMinutes } from 'date-fns'

const prisma = new PrismaClient()

function classifyDay(loginTime: Date | null, logoutTime: Date | null): DayStatus {
  if (!loginTime || !logoutTime) {
    return 'HALF_DAY'
  }

  const workedHours = (logoutTime.getTime() - loginTime.getTime()) / (1000 * 60 * 60)

  if (workedHours < 4) {
    return 'FULL_DAY_LEAVE'
  }
  if (workedHours < 7) {
    return 'HALF_DAY'
  }

  const istDate = new Date(loginTime.getTime() + (5.5 * 60 * 60 * 1000))
  const timeInMinutes = istDate.getUTCHours() * 60 + istDate.getUTCMinutes()

  if (timeInMinutes > 11 * 60) {
    return 'HALF_DAY'
  }
  if (timeInMinutes > 10 * 60 + 30) {
    return 'FULL_DAY_PRESENT_LATE'
  }

  return 'FULL_DAY_PRESENT'
}

async function main() {
  // Clear existing data
  await prisma.leaveBalance.deleteMany({})
  await prisma.attendanceLog.deleteMany({})
  await prisma.payslip.deleteMany({})
  await prisma.manualLeaveAdjustment.deleteMany({})
  await prisma.candidate.deleteMany({})

  const candidatesData = [
    { aeId: 'AE001', name: 'Alice Smith', type: 'FULL_TIME' as CandidateType, ctcAnnual: 50000 * 12, deviceUserId: '1', joiningDate: new Date('2023-01-15') },
    { aeId: 'AE002', name: 'Bob Johnson', type: 'FULL_TIME' as CandidateType, ctcAnnual: 60000 * 12, deviceUserId: '2', joiningDate: new Date('2024-03-10') },
    { aeId: 'AE003', name: 'Charlie Davis', type: 'INTERN' as CandidateType, ctcAnnual: 20000, deviceUserId: '3', joiningDate: new Date('2025-06-01') },
    { aeId: 'AE004', name: 'Diana Prince', type: 'FULL_TIME' as CandidateType, ctcAnnual: 55000 * 12, deviceUserId: '4', joiningDate: new Date('2022-11-20') },
    { aeId: 'AE005', name: 'Evan Wright', type: 'INTERN' as CandidateType, ctcAnnual: 15000, deviceUserId: '5', joiningDate: new Date('2026-05-10') },
  ]

  const candidates = []
  for (const data of candidatesData) {
    const candidate = await prisma.candidate.create({
      data: data,
    })
    candidates.push(candidate)
  }

  // 2. Generate previous month's Leave Balance so there is something carried forward
  for (const c of candidates) {
      await prisma.leaveBalance.create({
          data: {
              candidateId: c.id,
              month: 5,
              year: 2026,
              carriedForward: 0,
              freeQuota: c.type === 'FULL_TIME' ? 2 : 1,
              monthlyQuota: c.type === 'FULL_TIME' ? 2 : 1,
              availableLeaves: c.type === 'FULL_TIME' ? 2 : 1,
              usedLeaves: 1, // Assume they used 1
              excessLeaves: 0,
              nextCarryForward: c.type === 'FULL_TIME' ? 1 : 0
          }
      })
  }

  // 3. Generate a month of logs for June 2026
  const targetMonth = 5 // 0-indexed for Date, so June is 5
  const targetYear = 2026
  // Set start of month to exactly midnight UTC to match our model
  const startDate = new Date(Date.UTC(targetYear, targetMonth, 1))

  for (const c of candidates) {
    // Generate logs for 30 days of June
    for (let day = 0; day < 30; day++) {
      const currentDate = addDays(startDate, day)
      const dayOfWeek = currentDate.getUTCDay() // 0 is Sunday, 6 is Saturday

      let loginTime: Date | null = null
      let logoutTime: Date | null = null

      if (dayOfWeek !== 0) { // Not Sunday
        // Default normal day (9:00 AM to 6:00 PM UTC)
        loginTime = setMinutes(setHours(currentDate, 9), 0)
        logoutTime = setMinutes(setHours(currentDate, 18), 0)

        // Introduce some variations
        if (c.aeId === 'AE001' && day === 4) { // June 5th
          // Late
          loginTime = setMinutes(setHours(currentDate, 10), 45) // 10:45 AM
        } else if (c.aeId === 'AE002' && day === 10) { // June 11th
          // Half day (short hours)
          logoutTime = setMinutes(setHours(currentDate, 13), 0) // 1:00 PM
        } else if (c.aeId === 'AE003' && day === 15) { // June 16th
          // Missing punch
          logoutTime = null
        } else if (c.aeId === 'AE004' && dayOfWeek === 6) { // Saturday
          // Attends every Saturday
        } else if (c.aeId !== 'AE004' && dayOfWeek === 6) { // Saturday
          // Others don't attend Saturday by default
          if (c.aeId === 'AE001' && day === 5) { // June 6th (Group A)
             // Attends one Saturday to pass Group A compliance
          } else if (c.aeId === 'AE001' && day === 19) { // June 20th (Group B)
             // Attends another Saturday to pass Group B compliance
          } else {
             loginTime = null
             logoutTime = null
          }
        }
      }

      let status: DayStatus = 'WEEKEND_OFF'
      if (dayOfWeek === 0) {
        status = 'WEEKEND_OFF'
      } else {
        if (!loginTime || !logoutTime) {
          status = 'FULL_DAY_LEAVE'
        } else {
          status = classifyDay(loginTime, logoutTime)
        }
      }

      await prisma.attendanceLog.create({
        data: {
          candidateId: c.id,
          date: currentDate,
          loginTime,
          logoutTime,
          status
        }
      })
    }
  }

  console.log("Seeding complete")
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
