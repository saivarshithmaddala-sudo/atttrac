
const { getMonthlyData } = require('./src/lib/dashboard'); // This won't work if dashboard.ts is not compiled

// Let's use the DB check instead
const { PrismaClient } = require('./src/generated/client');
const prisma = new PrismaClient();

async function check() {
  const candidates = await prisma.candidate.findMany({
    where: { active: true, workLocation: 'FIELD' }
  });
  console.log('Active Field Candidates in DB:', candidates.length);
  candidates.forEach(c => console.log(c.name));
  await prisma.$disconnect();
}
check();
