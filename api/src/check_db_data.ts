import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkData() {
  try {
    const properties = await prisma.property.findMany({
      include: {
        units: {
          where: { deletedAt: null },
          include: {
            leases: {
              where: { status: 'ACTIVE', deletedAt: null },
              include: { tenant: true }
            }
          }
        }
      }
    });

    console.log(JSON.stringify(properties, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
