import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ZuriLeaseService } from './zuri-lease.service';
import { ConnectorConfig, ZuriLeaseData } from '../../sdk/zuri-lease';
import { createHash } from 'crypto';

function toUUID(prefix: string, id: string): string {
  if (!id) return '';
  const str = `${prefix}-${id}`;
  const hash = createHash('sha256').update(str).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16),
    ((parseInt(hash.substring(16, 17), 16) & 0x3) | 0x8).toString(16) +
      hash.substring(17, 20),
    hash.substring(20, 32),
  ].join('-');
}

function parseZuriDate(dateStr: string): Date {
  if (!dateStr || dateStr.toLowerCase().includes('invalid')) {
    return new Date();
  }

  // Try standard parsing first
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;

  // Handle dd-MMM-yyyy (e.g., 01-Sep-2024)
  const parts = dateStr.split(/[\/\-\s]/);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const monthInput = parts[1];
    const year = parseInt(parts[2], 10);

    // Map month names
    const months: Record<string, number> = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };

    let month = months[monthInput.toLowerCase().substring(0, 3)];
    if (month === undefined) {
      month = parseInt(monthInput, 10) - 1;
    }

    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      const d2 = new Date(year, month, day);
      if (!isNaN(d2.getTime())) return d2;
    }
  }

  return new Date();
}

@Injectable()
export class AedraImportService {
  private readonly logger = new Logger(AedraImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly zuriLeaseService: ZuriLeaseService,
  ) {}

  async importFromZuriLease(
    config: ConnectorConfig,
    propertyIds: string[],
    companyId: string,
    options?: { stage?: 'tenants' | 'full' },
  ) {
    const stage = options?.stage || 'full';
    const results = [];

    for (const propertyId of propertyIds) {
      try {
        this.logger.log(`Importing property ID ${propertyId}...`);
        const data = await this.zuriLeaseService.syncData(config, propertyId);

        if (
          !data.property.code &&
          !data.property.alias &&
          data.units.length === 0
        ) {
          this.logger.warn(
            `Skipping property ${propertyId}: No data returned (possible access error)`,
          );
          results.push({
            propertyId,
            status: 'skipped',
            reason: 'No data or access denied',
          });
          continue;
        }

        const imported = await this.saveToDatabase(data, companyId, options);
        results.push({ propertyId, status: 'success', imported });
      } catch (error) {
        this.logger.error(
          `Failed to import property ${propertyId}: ${error.message}`,
        );
        results.push({ propertyId, status: 'error', error: error.message });
      }
    }

    return results;
  }

  private async saveToDatabase(
    data: ZuriLeaseData,
    companyId: string,
    options?: { stage?: 'tenants' | 'full' },
  ) {
    const stage = options?.stage || 'full';
    const { property, units, tenants, payments } = data;

    // 1. Handle Landlord
    let landlordId = null;
    if (property.landlord && property.landlord.name) {
      const landlordNames = property.landlord.name.split(' ');
      const firstName = landlordNames[0] || 'Unknown';
      const lastName = landlordNames.slice(1).join(' ') || 'Landlord';

      const deterministicLandlordId = toUUID(
        'landlord',
        property.landlord.id || property.landlord.name,
      );
      const landlordRecord = await this.prisma.landlord.upsert({
        where: { id: deterministicLandlordId },
        update: {
          firstName,
          lastName,
        },
        create: {
          id: deterministicLandlordId,
          firstName,
          lastName,
          phone: '',
          companyId,
        },
      });
      landlordId = landlordRecord.id;
    }

    // 2. Handle Property
    const propertyUUID = toUUID('property', property.id);
    const propertyType = (property.type || '').includes('Commercial')
      ? 'COMMERCIAL'
      : 'RESIDENTIAL';
    const dbProperty = await this.prisma.property.upsert({
      where: { id: propertyUUID },
      update: {
        name: property.alias || property.code,
        address: `${property.location.area}, ${property.location.town}`,
        landlordId,
        propertyType,
      },
      create: {
        id: propertyUUID,
        name: property.alias || property.code,
        address: `${property.location.area}, ${property.location.town}`,
        companyId,
        landlordId,
        propertyType,
      },
    });

    // 3. Handle Tenants FIRST
    const tenantDbMap = new Map<string, any>(); // keyed by Zuri tenantId
    for (const tenant of tenants) {
      const tenantNames = tenant.name ? tenant.name.split(' ') : [];
      const tFirstName = tenantNames[0] || 'Unknown';
      const tLastName = tenantNames.slice(1).join(' ') || 'Tenant';

      const tenantUUID = toUUID('tenant', tenant.id);
      const dbTenant = await this.prisma.tenant.upsert({
        where: { id: tenantUUID },
        update: {
          firstName: tFirstName,
          lastName: tLastName,
          phone: tenant.phone || '',
        },
        create: {
          id: tenantUUID,
          firstName: tFirstName,
          lastName: tLastName,
          phone: tenant.phone || '',
          companyId,
          propertyId: dbProperty.id,
        },
      });
      tenantDbMap.set(tenant.id, { dbTenant, zuriTenant: tenant });
    }

    if (stage === 'tenants') {
      return {
        propertyId: dbProperty.id,
        unitsCount: 0,
        tenantsCount: tenants.length,
        paymentsCount: 0,
        historicalInvoicesCount: 0,
        historicalPaymentsCount: 0,
        stage: 'tenants_only',
      };
    }

    // 4. Handle Units & Leases
    const unitByZuriId = new Map<string, any>(); // keyed by Zuri unitId
    const leasedUnitIds = new Set<string>();

    for (const unit of units) {
      const unitUUID = toUUID('unit', unit.unitId);
      let unitStatus = unit.occupancyTenantName ? 'OCCUPIED' : 'VACANT';

      const dbUnit = await this.prisma.unit.upsert({
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

          let tenantRef = leaseData.tenantId
            ? tenantDbMap.get(leaseData.tenantId)
            : null;

          if (!tenantRef && leaseData.tenantName) {
            const localUUID = toUUID(
              'tenant',
              leaseData.tenantId || leaseData.tenantName,
            );
            const names = leaseData.tenantName.split(' ');
            const dbTenant = await this.prisma.tenant.upsert({
              where: { id: localUUID },
              update: {},
              create: {
                id: localUUID,
                firstName: names[0] || 'Unknown',
                lastName: names.slice(1).join(' ') || 'Tenant',
                phone: '',
                companyId,
                propertyId: dbProperty.id,
              },
            });
            tenantRef = { dbTenant };
          }

          if (!tenantRef) continue;

          const leaseUUID = toUUID(
            'lease',
            `${leaseData.tenantId || leaseData.tenantName}-${unit.unitId}-${leaseData.startDate}`,
          );
          const statusUpper = (leaseData.status || '').toUpperCase();
          const is_active =
            statusUpper === 'ACTIVE' || statusUpper === 'CURRENT';

          // If Zuri doesn't explicitly say Active/Current, fall back to date comparison
          const leaseExpiredByDate =
            new Date(parseZuriDate(leaseData.endDate)) <= new Date();
          const final_status = is_active
            ? 'ACTIVE'
            : leaseExpiredByDate
              ? 'EXPIRED'
              : 'ACTIVE';

          if (final_status === 'ACTIVE') unitStatus = 'OCCUPIED';

          await this.prisma.lease.upsert({
            where: { id: leaseUUID },
            update: {
              status: final_status as any,
            },
            create: {
              id: leaseUUID,
              startDate: parseZuriDate(leaseData.startDate),
              endDate: parseZuriDate(leaseData.endDate),
              rentAmount: unit.rent,
              status: final_status as any,
              propertyId: dbProperty.id,
              unitId: dbUnit.id,
              tenantId: tenantRef.dbTenant.id,
            },
          });
        }
      }

      await this.prisma.unit.update({
        where: { id: unitUUID },
        data: { status: unitStatus as any },
      });
    }

    // 5. Handle Tenant Historical Data (Invoices & Payments)
    for (const tenant of tenants) {
      if (
        (!tenant.receipts || tenant.receipts.length === 0) &&
        (!tenant.invoices || tenant.invoices.length === 0)
      )
        continue;

      const tenantUUID = toUUID('tenant', tenant.id);
      const tenantLeases = await this.prisma.lease.findMany({
        where: { tenantId: tenantUUID },
        orderBy: { startDate: 'asc' },
      });

      if (tenantLeases.length === 0) continue;

      // Helper to find the best lease match for a date
      const findLease = (date: Date) => {
        return (
          tenantLeases.find((l) => date >= l.startDate && date <= l.endDate) ||
          tenantLeases[tenantLeases.length - 1]
        );
      };

      // 5.1 Handle Historical Invoices
      if (tenant.invoices) {
        for (const inv of tenant.invoices) {
          const invDate = parseZuriDate(inv.date);
          const lease = findLease(invDate);
          const invoiceUUID = toUUID(
            'invoice',
            inv.code || `${tenant.id}-${inv.amount}-${inv.date}`,
          );

          await this.prisma.invoice.upsert({
            where: { id: invoiceUUID },
            update: {
              status: inv.status.toUpperCase() === 'PAID' ? 'PAID' : 'PENDING',
              amount: inv.amount,
            },
            create: {
              id: invoiceUUID,
              amount: inv.amount,
              description: inv.description || 'Historical Invoice (Zuri)',
              dueDate: parseZuriDate(inv.dueDate || inv.date),
              createdAt: invDate,
              status: inv.status.toUpperCase() === 'PAID' ? 'PAID' : 'PENDING',
              leaseId: lease.id,
              companyId,
            },
          });
        }
      }

      // 5.2 Handle Historical Payments (Receipts)
      if (tenant.receipts) {
        for (const rect of tenant.receipts) {
          const rectDate = parseZuriDate(rect.date);
          const lease = findLease(rectDate);
          const paymentUUID = toUUID(
            'payment',
            rect.code || `${tenant.id}-${rect.amount}-${rect.date}`,
          );

          await this.prisma.payment.upsert({
            where: { id: paymentUUID },
            update: {
              amount: rect.amount,
            },
            create: {
              id: paymentUUID,
              amount: rect.amount,
              paidAt: rectDate,
              reference: rect.code,
              notes: rect.description || 'Historical Receipt (Zuri)',
              method: 'MPESA',
              leaseId: lease.id,
            },
          });
        }
      }
    }

    // 6. Handle Payments (Remittances) as Income
    for (const payment of payments) {
      // Use a deterministic ID to avoid duplicates on re-import
      const incomeId = toUUID(
        'income',
        `${property.id}-${payment.grossAmount}-${payment.date}-${payment.code}`,
      );
      await this.prisma.income.upsert({
        where: { id: incomeId },
        update: {
          amount: payment.grossAmount,
          description: payment.description,
          date: parseZuriDate(payment.date),
        },
        create: {
          id: incomeId,
          amount: payment.grossAmount,
          description: payment.description,
          date: parseZuriDate(payment.date),
          category: 'COMMISSION', // Default for remittances
          companyId,
          propertyId: dbProperty.id,
        },
      });
    }

    return {
      propertyId: dbProperty.id,
      unitsCount: units.length,
      tenantsCount: tenants.length,
      paymentsCount: payments.length,
      historicalInvoicesCount: tenants.reduce(
        (acc, t) => acc + (t.invoices?.length || 0),
        0,
      ),
      historicalPaymentsCount: tenants.reduce(
        (acc, t) => acc + (t.receipts?.length || 0),
        0,
      ),
    };
  }
}
