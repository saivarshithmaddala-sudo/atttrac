import { PrismaClient } from '../src/generated/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.leaveBalance.deleteMany({})
  await prisma.attendanceLog.deleteMany({})
  await prisma.candidate.deleteMany({})
  console.log('Database cleared.')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
