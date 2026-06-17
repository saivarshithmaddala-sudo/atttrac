const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const c = await prisma.candidate.findFirst({ where: { name: 'JISHNU' } });
  console.log('JISHNU Joining Date:', c.joiningDate);
}
run();
