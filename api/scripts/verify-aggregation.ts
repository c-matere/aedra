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
    const stats = await prisma.$transaction([
      prisma.property.count(),
      prisma.unit.count(),
      prisma.tenant.count(),
      prisma.lease.count(),
      prisma.income.count(),
    ]);

    console.log('--- Aggregate Stats ---');
    console.log('Properties:', stats[0]);
    console.log('Units:', stats[1]);
    console.log('Tenants:', stats[2]);
    console.log('Leases:', stats[3]);
    console.log('Income Records:', stats[4]);

    const recentProps = await prisma.property.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { units: true, tenants: true, leases: true }
        }
      }
    });

    console.log('\n--- Recent Properties ---');
    recentProps.forEach(p => {
      console.log(`- ${p.name} (Code: ${p.id.substring(0,8)}): ${p._count.units} units, ${p._count.tenants} tenants, ${p._count.leases} leases`);
    });

  } catch (e: any) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
