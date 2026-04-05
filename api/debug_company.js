const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const companyId = 'd06b99a6-32a3-43b4-917a-d5a25c864337';
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });
  console.log(JSON.stringify(company, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
