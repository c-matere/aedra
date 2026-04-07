const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const phone = '0705660625';
  const phone2 = '254705660625';

  console.log(`Deletions starting for ${phone}`);
  
  await prisma.$executeRawUnsafe(`DELETE FROM "ChatHistory" WHERE "waPhone" LIKE '%0705660625%' OR "waPhone" LIKE '%254705660625%'`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Tenant" WHERE "phone" LIKE '%0705660625%' OR "phone" LIKE '%254705660625%'`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Landlord" WHERE "phone" LIKE '%0705660625%' OR "phone" LIKE '%254705660625%'`);
  await prisma.$executeRawUnsafe(`DELETE FROM "CompanyStaff" WHERE "phone" LIKE '%0705660625%' OR "phone" LIKE '%254705660625%'`);
  await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE "phone" LIKE '%0705660625%' OR "phone" LIKE '%254705660625%'`);
  console.log('Cleanup Done');
}

main().catch(console.error).finally(() => prisma.$disconnect());
