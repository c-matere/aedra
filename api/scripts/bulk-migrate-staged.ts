import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { ZuriLeaseConnector } from '../src/integrations/zuri-lease/zuri-lease.connector';
import * as dotenv from 'dotenv';
import { createHash } from 'crypto';

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

  const config = {
    domain: 'sak.zurilease.app',
    credentials: {
      username: 'matere chris',
      password: 'Matere@2025',
    },
  };

  const propertyIds = ["0001", "0011", "0019", "0021", "0023", "0024", "0026", "0027", "0030", "0031", "0035", "0036", "0037"];
  const companyId = 'e673537b-5249-472f-b209-e09f12b23db4';

  const args = process.argv.slice(2);
  const isFullMigration = args.includes('--stage=full');

  console.log(`\n=== Starting Bulk Staged Migration ===`);
  console.log(`Stage: ${isFullMigration ? 'FULL (Step 2)' : 'TENANTS ONLY (Step 1)'}`);
  console.log(`Properties: ${propertyIds.length}\n`);

  const connector = new ZuriLeaseConnector(config);
  await connector.connect();

  for (const propertyId of propertyIds) {
    try {
      console.log(`--- Processing Property ID: ${propertyId} ---`);
      const data = await connector.fetchData({ propertyId });
      const { property, units, tenants } = data;

      console.log(`- Property: ${property.alias || property.code} (${property.location.town}, ${property.location.area})`);
      console.log(`- Units found: ${units.length}`);
      console.log(`- Tenants found: ${tenants.length}`);

      // Skip invalid/inaccessible properties
      if (!property.code && !property.alias && units.length === 0) {
        console.warn(`⚠️ Skipped property ${propertyId}: No data or access denied.`);
        continue;
      }

      // 1. Handle Landlord
      let landlordId = null;
      if (property.landlord && property.landlord.name) {
        const landlordNames = property.landlord.name.split(' ');
        const firstName = landlordNames[0] || 'Unknown';
        const lastName = landlordNames.slice(1).join(' ') || 'Landlord';
        landlordId = toUUID('landlord', property.landlord.id || property.landlord.name);

        await prisma.landlord.upsert({
          where: { id: landlordId },
          update: { firstName, lastName },
          create: { id: landlordId, firstName, lastName, phone: '', companyId },
        });
      }

      // 2. Handle Property Skeleton
      const propertyUUID = toUUID('property', property.id);
      const dbProperty = await prisma.property.upsert({
        where: { id: propertyUUID },
        update: {
          name: property.alias || property.code,
          address: `${property.location.area}, ${property.location.town}`,
          landlordId,
        },
        create: {
          id: propertyUUID,
          name: property.alias || property.code,
          address: `${property.location.area}, ${property.location.town}`,
          companyId,
          landlordId,
        },
      });

      // 3. Handle Tenants
      for (const tenant of tenants) {
        const tenantUUID = toUUID('tenant', tenant.id);
        const names = tenant.name.split(' ');
        await prisma.tenant.upsert({
          where: { id: tenantUUID },
          update: { phone: tenant.phone || '' },
          create: {
            id: tenantUUID,
            firstName: names[0] || 'Unknown',
            lastName: names.slice(1).join(' ') || 'Tenant',
            phone: tenant.phone || '',
            companyId,
            propertyId: dbProperty.id,
          },
        });
      }
      console.log(`✅ Step 1 Success: ${tenants.length} tenants imported for ${property.alias || property.code}.`);

      // Step 2 is currently handled in the full migration if requested, 
      // but for now we focus on Step 1 as requested.
      if (isFullMigration) {
          console.log('Skipping Step 2 in this script for now - use existing migration scripts or extend this one.');
      }

    } catch (error) {
      console.error(`❌ Error with property ${propertyId}:`, error.message);
    }
  }

  console.log('\nBulk migration completion.');
  await connector.disconnect();
  await prisma.$disconnect();
  await pool.end();
}

main();
