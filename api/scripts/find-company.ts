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

  try {
    const companies = await prisma.company.findMany({ select: { id: true, name: true } });
    console.log('Companies:', JSON.stringify(companies, null, 2));
  } catch (e: any) {
    console.error('Full Error:', e);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
