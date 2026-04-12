import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { createHash } from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

function toUUID(prefix: string, id: string): string {
  if (!id) return '';
  const str = `${prefix}-${id}`;
  const hash = createHash('sha256').update(str).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16),
    ((parseInt(hash.substring(16, 17), 16) & 0x3) | 0x8).toString(16) + hash.substring(17, 20),
    hash.substring(20, 32)
  ].join('-');
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const propertyId = "0023";
  const propertyUUID = toUUID('property', propertyId);

  console.log(`--- Verifying Property ${propertyId} (${propertyUUID}) ---`);
  
  const property = await prisma.property.findUnique({
    where: { id: propertyUUID },
    include: {
      tenants: true,
      leases: {
        include: {
          tenant: true,
          unit: true
        }
      }
    }
  });

  if (!property) {
    console.error('Property not found!');
  } else {
    console.log(`Property Name: ${property.name}`);
    console.log(`Tenants Found: ${property.tenants.length}`);
    property.tenants.forEach(t => {
      console.log(`- Tenant: ${t.firstName} ${t.lastName}, Phone: ${t.phone || 'MISSING'}`);
    });

    console.log(`Leases Found: ${property.leases.length}`);
    property.leases.forEach(l => {
      console.log(`- Lease for ${l.tenant.firstName} on Unit ${l.unit?.unitNumber || '?'}: Status=${l.status}, Start=${l.startDate.toISOString()}, End=${l.endDate.toISOString()}`);
    });
  }

  await prisma.$disconnect();
  await pool.end();
}

main();
