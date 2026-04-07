import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findFirst({
    where: { role: 'COMPANY_ADMIN', NOT: { phone: null } },
  });
  console.log('User found:', user);
}
main().catch(console.error).finally(() => prisma.$disconnect());
