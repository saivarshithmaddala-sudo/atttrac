const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const candidate = await prisma.candidate.findFirst({ where: { aeId: 'AE18883' } });
  
  const start = new Date(Date.UTC(2026, 5, 1));
  const end = new Date(Date.UTC(2026, 6, 0, 23, 59, 59, 999));
  const logs = await prisma.attendanceLog.findMany({ where: { candidateId: candidate.id, date: { gte: start, lte: end } } });

  const prevBalances = await prisma.leaveBalance.findMany({ where: { month: 5, year: 2026, candidateId: candidate.id } });
  const previousCarryForward = prevBalances.length > 0 ? prevBalances[0].nextCarryForward : 0;

  const manualAdjustments = await prisma.manualLeaveAdjustment.findMany({ where: { candidateId: candidate.id, date: { gte: start, lte: end } } });

  // Simulate engine.ts
  const targetYear = 2026;
  const targetMonth = 5;

  let free_quota_this_month = 2.0;

  const daysInMonth = 30;
  const allDays = [];
  for (let i = 1; i <= daysInMonth; i++) {
    allDays.push(new Date(Date.UTC(targetYear, targetMonth, i)));
  }

  let total_leave_units = 0;
  let candidateEarnedDays = 2; // assume 2 mandatory saturdays for simplicity

  for (const date of allDays) {
    const isWeekday = date.getUTCDay() >= 1 && date.getUTCDay() <= 5;
    
    const isBeforeJoining = date.getTime() < new Date(Date.UTC(candidate.joiningDate.getUTCFullYear(), candidate.joiningDate.getUTCMonth(), candidate.joiningDate.getUTCDate())).getTime();
    if (isBeforeJoining) continue;

    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const isFutureDate = date.getTime() > todayUTC.getTime();

    if (isWeekday) {
      if (!isFutureDate) {
        candidateEarnedDays++;
      }
    }

    if (isWeekday) {
      const log = logs.find(l => l.date.getUTCDate() === date.getUTCDate());
      let actualStatus;
      if (isFutureDate && !log) actualStatus = 'PENDING';
      else if (log) actualStatus = 'PRESENT';
      else actualStatus = 'LEAVE';

      if (actualStatus === 'LEAVE') total_leave_units += 1;
    }
  }

  console.log({
     candidateEarnedDays,
     total_leave_units,
     previousCarryForward,
     manualAdjustments
  });
}
run();
