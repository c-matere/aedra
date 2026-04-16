import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { ZuriLeaseConnector } from '../src/sdk/zuri-lease';
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

function parseZuriDate(dateStr: string): Date {
  if (!dateStr || dateStr.toLowerCase().includes('invalid')) {
    return new Date();
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const d2 = new Date(year, month, day);
    if (!isNaN(d2.getTime())) return d2;
  }
  return new Date();
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

  // Property IDs mapped from codes: 001, 0011, 0019, 0021, 0023, 0024, 0026, 0027, 0030, 00331(31), 0035, 00036(41), 0037
  const propertyIds = ["1", "35", "19", "21", "23", "24", "26", "27", "30", "31", "40", "41", "42"];
  const companyId = 'e673537b-5249-472f-b209-e09f12b23db4';

  const connector = new ZuriLeaseConnector(config);
  await connector.connect();

  console.log(`Starting aggregation for ${propertyIds.length} properties...`);

  for (const propertyId of propertyIds) {
    try {
      console.log(`\n--- Processing Property ID: ${propertyId} ---`);
      const data = await connector.fetchData({ propertyId });
      const { property, units, payments, tenants } = data;

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
          create: {
            id: landlordId,
            firstName,
            lastName,
            phone: '',
            companyId,
          },
        });
      }

      // 2. Handle Property
      const propertyUUID = toUUID('property', property.id);
      const dbProperty = await prisma.property.upsert({
        where: { id: propertyUUID },
        update: {
          name: property.alias || property.code,
          address: `${property.location.area}, ${property.location.town}`,
          landlordId,
          propertyType: property.type && property.type.includes('Commercial') ? 'COMMERCIAL' : 'RESIDENTIAL',
        },
        create: {
          id: propertyUUID,
          name: property.alias || property.code,
          address: `${property.location.area}, ${property.location.town}`,
          companyId,
          landlordId,
          propertyType: property.type && property.type.includes('Commercial') ? 'COMMERCIAL' : 'RESIDENTIAL',
        },
      });
      console.log(`Property: ${dbProperty.name} (Code: ${property.code})`);

      // 3. All Tenants First
      const tenantMap = new Map();
      for (const tenant of tenants) {
        const tenantUUID = toUUID('tenant', tenant.id);
        const names = tenant.name ? tenant.name.split(' ') : ['Unknown'];
        const firstName = names[0];
        const lastName = names.slice(1).join(' ') || 'Tenant';

        const dbTenant = await prisma.tenant.upsert({
          where: { id: tenantUUID },
          update: {
            firstName,
            lastName,
            phone: tenant.phone || '',
          },
          create: {
            id: tenantUUID,
            firstName,
            lastName,
            phone: tenant.phone || '',
            companyId,
            propertyId: dbProperty.id,
          },
        });
        tenantMap.set(tenant.id, dbTenant);
      }
      console.log(`Upserted ${tenants.length} tenants.`);

      // 4. Units & Leases
      for (const unit of units) {
        const unitUUID = toUUID('unit', unit.unitId);
        let unitStatus = unit.occupancyTenantName ? 'OCCUPIED' : 'VACANT';

        const dbUnit = await prisma.unit.upsert({
          where: { id: unitUUID },
          update: {
            unitNumber: unit.unitCode,
            rentAmount: unit.rent,
            propertyId: dbProperty.id,
          },
          create: {
            id: unitUUID,
            unitNumber: unit.unitCode,
            rentAmount: unit.rent,
            status: 'VACANT',
            propertyId: dbProperty.id,
          },
        });

        if (unit.leases && unit.leases.length > 0) {
          for (const leaseData of unit.leases) {
            if (!leaseData.tenantId && !leaseData.tenantName) continue;

            let tenantRef = tenantMap.get(leaseData.tenantId);

            if (!tenantRef && leaseData.tenantName) {
              const localUUID = toUUID('tenant', leaseData.tenantId || leaseData.tenantName);
              const names = leaseData.tenantName.split(' ');
              tenantRef = await prisma.tenant.upsert({
                where: { id: localUUID },
                update: {},
                create: {
                  id: localUUID,
                  firstName: names[0] || 'Unknown',
                  lastName: names.slice(1).join(' ') || 'Tenant',
                  phone: '',
                  companyId,
                  propertyId: dbProperty.id,
                }
              });
            }

            if (!tenantRef) continue;

            const leaseUUID = toUUID('lease', `${leaseData.tenantId || leaseData.tenantName}-${unit.unitId}-${leaseData.startDate}`);
            const is_active = (leaseData.status || '').toUpperCase() === 'ACTIVE' || 
                              (leaseData.status || '').toUpperCase() === 'CURRENT' ||
                              (new Date(parseZuriDate(leaseData.endDate)) > new Date());
            
            if (is_active) unitStatus = 'OCCUPIED';

            await prisma.lease.upsert({
              where: { id: leaseUUID },
              update: {
                status: is_active ? 'ACTIVE' : 'EXPIRED',
              },
              create: {
                id: leaseUUID,
                startDate: parseZuriDate(leaseData.startDate),
                endDate: parseZuriDate(leaseData.endDate),
                rentAmount: unit.rent,
                status: is_active ? 'ACTIVE' : 'EXPIRED',
                propertyId: dbProperty.id,
                unitId: dbUnit.id,
                tenantId: tenantRef.id,
              },
            });
          }
        }

        await prisma.unit.update({
          where: { id: unitUUID },
          data: { status: unitStatus as any }
        });
      }
      console.log(`Imported ${units.length} units.`);

      // 5. Handle Payments/Income
      for (const payment of payments) {
        const incomeUUID = toUUID('income', `${propertyId}-${payment.grossAmount}-${payment.date}-${payment.code}`);
        await prisma.income.upsert({
          where: { id: incomeUUID },
          update: {
            amount: payment.grossAmount,
            description: payment.description,
            date: parseZuriDate(payment.date),
          },
          create: {
            id: incomeUUID,
            amount: payment.grossAmount,
            description: payment.description,
            date: parseZuriDate(payment.date),
            category: 'COMMISSION', 
            companyId,
            propertyId: dbProperty.id,
          },
        });
      }
      console.log(`Imported ${payments.length} payment records.`);

    } catch (error) {
      console.error(`Error processing property ${propertyId}:`, error.message);
    }
  }

  console.log('\nAggregation process completed.');
  await connector.disconnect();
  await prisma.$disconnect();
  await pool.end();
}

main();
