const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const c = await prisma.candidate.findFirst({ where: { name: 'M SAI VARSHITH' } });
  console.log('Joining Date:', c.joiningDate);
}
run();
