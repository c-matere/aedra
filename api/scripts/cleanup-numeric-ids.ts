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

  console.log('Cleaning up non-UUID properties...');

  // 1. Find properties with numeric IDs
  const properties = await prisma.property.findMany({
    where: {
      companyId: 'e673537b-5249-472f-b209-e09f12b23db4',
    },
    select: { id: true, name: true }
  });

  const numericProperties = properties.filter(p => !p.id.includes('-'));

  if (numericProperties.length === 0) {
    console.log('No non-UUID properties found.');
  } else {
    for (const p of numericProperties) {
      console.log(`Deleting property: ${p.name} (ID: ${p.id})`);
      // Cascading delete might be needed if relations aren't handled by Prisma/DB
      // We'll delete related items first if necessary
      await prisma.income.deleteMany({ where: { propertyId: p.id } });
      await prisma.lease.deleteMany({ where: { propertyId: p.id } });
      await prisma.unit.deleteMany({ where: { propertyId: p.id } });
      await prisma.tenant.deleteMany({ where: { propertyId: p.id } });
      await prisma.property.delete({ where: { id: p.id } });
    }
    console.log(`Deleted ${numericProperties.length} properties.`);
  }

  await prisma.$disconnect();
  await pool.end();
}

main();
