const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { calculateMonthlySummary } = require('./src/lib/engine.ts');

async function test() {
  try {
    const candidates = await prisma.candidate.findMany({ where: { active: true } });
    console.log('Candidates found:', candidates.length);
    for (const c of candidates) {
        console.log('Candidate type:', c.type);
    }
  } catch (e) {
    console.error(e);
  }
}
test();
