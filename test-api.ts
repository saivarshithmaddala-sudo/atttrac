import { PrismaClient } from './src/generated/client';
import { calculateMonthlySummary } from './src/lib/engine';

const prisma = new PrismaClient();

async function test() {
  try {
    const candidates = await prisma.candidate.findMany({ where: { active: true } });
    const logs = [];
    const year = 2026;
    const targetMonth0to11 = 5;

    for (const candidate of candidates) {
      console.log('Calculating for:', candidate.aeId);
      const summary = calculateMonthlySummary({
        candidate: {
          type: candidate.type as any,
          monthlySalary: candidate.type === 'INTERN' ? candidate.ctcAnnual : candidate.ctcAnnual / 12,
          joiningDate: candidate.joiningDate
        },
        logs: [],
        previousCarryForward: 0,
        targetYear: year,
        targetMonth: targetMonth0to11
      });
      console.log(summary);
    }
  } catch (e) {
    console.error(e);
  }
}
test();
