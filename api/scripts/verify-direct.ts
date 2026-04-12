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

  console.log(`--- Checking Tenant and Lease directly ---`);
  
  const tenant = await prisma.tenant.findUnique({
    where: { id: 'ed9647c1-5d3d-4426-8351-e0cc45ecb080' },
    include: { property: true }
  });

  if (tenant) {
    console.log(`Tenant: ${tenant.firstName} ${tenant.lastName}, Phone: ${tenant.phone}, PropID: ${tenant.propertyId}, PropName: ${tenant.property?.name}`);
  } else {
    console.log(`Tenant NOT found by UUID ed9647c1-5d3d-4426-8351-e0cc45ecb080`);
  }

  const leases = await prisma.lease.findMany({
    where: { tenantId: 'ed9647c1-5d3d-4426-8351-e0cc45ecb080' },
    include: { property: true }
  });

  console.log(`Leases count: ${leases.length}`);
  leases.forEach(l => {
    console.log(`- Lease status: ${l.status}, Start: ${l.startDate}, End: ${l.endDate}`);
  });

  await prisma.$disconnect();
  await pool.end();
}

main();
