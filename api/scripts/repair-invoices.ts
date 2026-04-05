import { PrismaClient, InvoiceType } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function repair() {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('--- INVOICE REPAIR SCRIPT ---');

    // 1. Get all leases
    const leases = await prisma.lease.findMany({
      where: { deletedAt: null },
      include: { 
        invoices: true,
        payments: true,
        unit: true 
      }
    });

    console.log(`Found ${leases.length} leases. Checking for missing invoices...`);

    let createdCount = 0;

    for (const lease of leases) {
      // 2. Check for Security Deposit Invoice (using OTHER as placeholder for DEPOSIT)
      const hasDepositInvoice = lease.invoices.some(inv => inv.type === InvoiceType.OTHER || inv.description.toLowerCase().includes('deposit'));
      if (!hasDepositInvoice && lease.deposit && lease.deposit > 0) {
        await prisma.invoice.create({
          data: {
            amount: lease.deposit,
            description: 'Security Deposit',
            type: InvoiceType.OTHER,
            dueDate: lease.startDate,
            status: 'PAID',
            leaseId: lease.id,
            createdAt: lease.startDate
          }
        });
        createdCount++;
      }

      // 3. Create Invoices for each Payment (Rent)
      for (const payment of lease.payments) {
        const hasMatchingInvoice = lease.invoices.some(inv => 
          inv.amount === payment.amount && 
          inv.dueDate.toDateString() === payment.paidAt.toDateString()
        );

        if (!hasMatchingInvoice) {
          await prisma.invoice.create({
            data: {
              amount: payment.amount,
              description: `Rent Invoice - ${payment.paidAt.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
              type: InvoiceType.RENT,
              dueDate: payment.paidAt,
              status: 'PAID',
              leaseId: lease.id,
              createdAt: payment.paidAt
            }
          });
          createdCount++;
        }
      }
    }

    console.log(`✅ Success! Created ${createdCount} missing invoices.`);

  } catch (e) {
    console.error('Repair failed:', e);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

repair();
