import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log(`--- Investigating Tenants and Leases ---`);
  
  // Find all tenants created in the last 15 minutes
  const recentTenants = await prisma.tenant.findMany({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 15 * 60 * 1000)
      }
    },
    include: { property: true }
  });

  console.log(`Recent Tenants Found: ${recentTenants.length}`);
  recentTenants.forEach(t => {
    console.log(`- Tenant: ${t.firstName} ${t.lastName} (ID: ${t.id}), Property: ${t.property?.name ?? 'NULL'} (PropID: ${t.propertyId})`);
  });

  const recentLeases = await prisma.lease.findMany({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 15 * 60 * 1000)
      }
    },
    include: { tenant: true, property: true }
  });

  console.log(`Recent Leases Found: ${recentLeases.length}`);
  recentLeases.forEach(l => {
    console.log(`- Lease for ${l.tenant?.firstName} ${l.tenant?.lastName}, Status: ${l.status}, Property: ${l.property?.name ?? 'NULL'}`);
  });

  await prisma.$disconnect();
  await pool.end();
}

main();
