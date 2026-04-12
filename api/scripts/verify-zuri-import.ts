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
  const companyId = 'e673537b-5249-472f-b209-e09f12b23db4';

  console.log(`Checking company: ${companyId}`);
  
  const properties = await prisma.property.findMany({
    where: { companyId },
    include: {
      _count: {
        select: {
          units: true,
          leases: true,
          tenants: true,
        }
      }
    }
  });

  console.log(`Found ${properties.length} properties.`);
  
  for (const prop of properties) {
    console.log(`Property: ${prop.name} (ID: ${prop.id})`);
    console.log(`  Units: ${prop._count.units}`);
    console.log(`  Tenants: ${prop._count.tenants}`);
    console.log(`  Leases: ${prop._count.leases}`);
    
    // Check if any units are occupied but have no lease
    const occupiedUnitsWithoutLease = await prisma.unit.count({
      where: {
        propertyId: prop.id,
        status: 'OCCUPIED',
        leases: {
          none: {}
        }
      }
    });
    
    if (occupiedUnitsWithoutLease > 0) {
      console.warn(`  !!! WARNING: ${occupiedUnitsWithoutLease} occupied units waiting for lease sync.`);
    } else {
      console.log(`  Success: All occupied units have associated leases.`);
    }
  }

  await prisma.$disconnect();
}

main();
