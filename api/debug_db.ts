
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debug() {
  const companyId = 'bench-company-001';
  const propId = 'bench-prop-palms';
  const now = new Date();
  const start = new Date(now.getTime() - 31 * 24 * 3600 * 1000);
  const end = new Date(now.getTime() + 1 * 24 * 3600 * 1000);

  console.log('Querying payments for:', { companyId, propId, start, end });

  const payments = await prisma.payment.findMany({
    where: {
      lease: {
        property: {
          companyId: companyId,
          id: propId
        }
      },
      paidAt: { gte: start, lte: end },
      deletedAt: null
    },
    include: {
      lease: {
        include: {
          property: true
        }
      }
    }
  });

  console.log('Found payments count:', payments.length);
  if (payments.length > 0) {
    console.log('First payment amount:', payments[0].amount);
    console.log('First payment lease property ID:', payments[0].lease?.propertyId);
  }

  const expenses = await prisma.expense.findMany({
    where: {
      companyId: companyId,
      propertyId: propId,
      date: { gte: start, lte: end },
      deletedAt: null
    }
  });

  console.log('Found expenses count:', expenses.length);
  if (expenses.length > 0) {
    console.log('First expense amount:', expenses[0].amount);
  }

  await prisma.$disconnect();
}

debug().catch(console.error);
