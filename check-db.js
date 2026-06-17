
const { PrismaClient } = require('./src/generated/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const candidates = await prisma.candidate.findMany();
    console.log('--- ALL CANDIDATES ---');
    candidates.forEach(c => {
      console.log(`${c.name} | Active: ${c.active} | Location: ${c.workLocation} | AEID: ${c.aeId}`);
    });
    console.log('----------------------');
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
