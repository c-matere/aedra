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

  console.log(`--- Listing All Properties ---`);
  const properties = await prisma.property.findMany({
    select: { id: true, name: true, _count: { select: { tenants: true, leases: true } } }
  });

  properties.forEach(p => {
    console.log(`- Property: ${p.name} (UUID: ${p.id}), Tenants: ${p._count.tenants}, Leases: ${p._count.leases}`);
  });

  await prisma.$disconnect();
  await pool.end();
}

main();
