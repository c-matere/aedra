import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const companyId = '1b16fe30-d0f9-4def-bf1d-52fc4850dc9b';

async function main() {
  console.log(`# Duplicate Tenant Report for Company ${companyId}`);
  console.log(`Generated at: ${new Date().toISOString()}\n`);

  const tenants = await prisma.tenant.findMany({
    where: {
      companyId,
      deletedAt: null,
    },
    include: {
      property: true,
      leases: {
        include: {
          payments: true,
        },
      },
    },
  });

  console.log(`Total active tenants found: ${tenants.length}\n`);

  const groups = new Map<string, typeof tenants>();

  for (const tenant of tenants) {
    const key = `${tenant.firstName.trim().toLowerCase()}|${tenant.lastName.trim().toLowerCase()}|${(tenant.email || '').trim().toLowerCase()}|${(tenant.phone || '').trim().toLowerCase()}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(tenant);
  }

  let duplicateGroupsCount = 0;
  let totalDuplicatesFound = 0;

  for (const [key, group] of groups.entries()) {
    if (group.length > 1) {
      duplicateGroupsCount++;
      totalDuplicatesFound += group.length - 1;

      const [firstName, lastName, email, phone] = key.split('|');
      console.log(`## Duplicate Group: ${firstName.toUpperCase()} ${lastName.toUpperCase()}`);
      console.log(`- Email: ${email || 'N/A'}`);
      console.log(`- Phone: ${phone || 'N/A'}\n`);

      // Sort tenants by latest activity
      const sortedGroup = group.map(t => {
        const lastPaymentDate = t.leases.flatMap(l => l.payments).reduce((max, p) => p.paidAt > max ? p.paidAt : max, new Date(0));
        const lastLeaseDate = t.leases.reduce((max, l) => l.createdAt > max ? l.createdAt : max, new Date(0));
        const lastActivity = lastPaymentDate > lastLeaseDate ? lastPaymentDate : lastLeaseDate;
        return { ...t, lastActivity };
      }).sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

      console.log(`| Status | Tenant ID | Property | Leases | Payments | Last Activity |`);
      console.log(`| :--- | :--- | :--- | :--- | :--- | :--- |`);

      for (let i = 0; i < sortedGroup.length; i++) {
        const t = sortedGroup[i];
        const status = i === 0 ? '**KEEP**' : 'DUPLICATE';
        const leaseCount = t.leases.length;
        const paymentCount = t.leases.flatMap(l => l.payments).length;
        const lastActivityStr = t.lastActivity.getTime() === 0 ? 'None' : t.lastActivity.toISOString().split('T')[0];
        
        console.log(`| ${status} | \`${t.id}\` | ${t.property.name} | ${leaseCount} | ${paymentCount} | ${lastActivityStr} |`);
      }
      console.log('\n---\n');
    }
  }

  console.log(`\n**Summary:**`);
  console.log(`- Detected ${duplicateGroupsCount} groups of duplicate tenants.`);
  console.log(`- Total redundant records identified: ${totalDuplicatesFound}.`);
  console.log(`\n**Recommendation:** Archive the records marked as DUPLICATE after verifying their data has been consolidated if necessary.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
