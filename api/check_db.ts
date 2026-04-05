
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

async function checkDb() {
  const connectionString = process.env.DATABASE_URL;
  console.log('Using DATABASE_URL:', connectionString);
  
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  
  try {
    const companyCount = await prisma.company.count({
      where: { id: 'bench-company-001' }
    });
    console.log('Company bench-company-001 count:', companyCount);

    const properties = await prisma.property.findMany({
      where: { companyId: 'bench-company-001' },
      select: { id: true, name: true }
    });
    console.log('Properties:', JSON.stringify(properties, null, 2));

    if (properties.length === 0) {
      console.log('No properties found for bench-company-001. Fetching all properties...');
      const allProps = await prisma.property.findMany({
        take: 10,
        select: { id: true, name: true, companyId: true }
      });
      console.log('Sample properties:', JSON.stringify(allProps, null, 2));
    }

  } catch (err) {
    console.error('Error querying DB:', err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

checkDb();
