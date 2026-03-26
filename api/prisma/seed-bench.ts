import {
  PrismaClient,
  UserRole,
  PropertyType,
  UnitStatus,
  LeaseStatus,
  PaymentMethod,
  PaymentType,
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus
} from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import * as bcryptjs from 'bcryptjs';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding Benchmark Database...');

  const hashedDefaultPassword = await bcryptjs.hash('Aedra@2026', 10);
  const companyId = 'bench-company-001';
  const superAdminId = '3a33e9db-4e47-4ede-87d0-b4978f455b12';

  // 1. Company
  await prisma.company.upsert({
    where: { id: companyId },
    update: {},
    create: {
      id: companyId,
      name: 'Benchmark Property Management',
      email: 'bench@management.co.ke',
      phone: '+254700000000',
      address: 'Nairobi, Kenya',
      isActive: true,
    },
  });

  // 2. Super Admin User
  await prisma.user.upsert({
    where: { id: superAdminId },
    update: {},
    create: {
      id: superAdminId,
      email: 'bench-admin@aedra.co.ke',
      password: hashedDefaultPassword,
      firstName: 'Bench',
      lastName: 'Admin',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      companyId: companyId,
    },
  });

  // 3. Properties
  const properties = [
    { id: 'palm-grove-001', name: 'Palm Grove', address: 'Westlands, Nairobi' },
    { id: 'ocean-view-001', name: 'Ocean View', address: 'Nyali, Mombasa' },
    { id: 'bahari-ridge-001', name: 'Bahari Ridge', address: 'Kilifi, Coastal' },
    { id: 'kilimani-heights-001', name: 'Kilimani Heights', address: 'Kilimani, Nairobi' },
  ];

  for (const prop of properties) {
    await prisma.property.upsert({
      where: { id: prop.id },
      update: {},
      create: {
        ...prop,
        propertyType: PropertyType.RESIDENTIAL,
        companyId: companyId,
      },
    });
  }

  // 4. Units
  const unitsData = [
    { id: 'unit-b4-palm', unitNumber: 'B4', propertyId: 'palm-grove-001', rentAmount: 25000 },
    { id: 'unit-c2-palm', unitNumber: 'C2', propertyId: 'palm-grove-001', rentAmount: 35000 },
    { id: 'unit-c2-ocean', unitNumber: 'C2', propertyId: 'ocean-view-001', rentAmount: 30000 },
    { id: 'unit-101-bahari', unitNumber: '101', propertyId: 'bahari-ridge-001', rentAmount: 45000 },
    { id: 'unit-a1-kilimani', unitNumber: 'A1', propertyId: 'kilimani-heights-001', rentAmount: 40000 },
    { id: 'unit-204-ocean', unitNumber: '204', propertyId: 'ocean-view-001', rentAmount: 28000 },
  ];

  for (const u of unitsData) {
    await prisma.unit.upsert({
      where: { id: u.id },
      update: {},
      create: {
        ...u,
        status: UnitStatus.OCCUPIED,
      },
    });
  }

  // 5. Tenants
  const tenantsData = [
    { id: 'tenant-fatuma-001', firstName: 'Fatuma', lastName: 'Ali', email: 'fatuma@example.com', unitId: 'unit-b4-palm', propertyId: 'palm-grove-001' },
    { id: 'tenant-grace-001', firstName: 'Grace', lastName: 'Wambui', email: 'grace@example.com', unitId: 'unit-c2-ocean', propertyId: 'ocean-view-001' },
    { id: 'tenant-samuel-001', firstName: 'Samuel', lastName: 'Kamau', email: 'samuel@example.com', unitId: 'unit-101-bahari', propertyId: 'bahari-ridge-001' },
    { id: 'tenant-brian-002', firstName: 'Brian', lastName: 'Ochieng', email: 'brian@example.com', unitId: 'unit-a1-kilimani', propertyId: 'kilimani-heights-001' },
  ];

  for (const t of tenantsData) {
    const { unitId, ...tenantProps } = t;
    const tenant = await prisma.tenant.upsert({
      where: { id: t.id },
      update: {},
      create: {
        ...tenantProps,
        companyId: companyId,
        propertyId: t.propertyId,
      },
    });

    // Create Lease
    const unit = unitsData.find(u => u.id === unitId);
    if (unit) {
      await prisma.lease.create({
        data: {
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          rentAmount: unit.rentAmount,
          status: LeaseStatus.ACTIVE,
          propertyId: t.propertyId,
          unitId: unitId,
          tenantId: tenant.id,
        },
      });
    }
  }

  // 6. Specific Arrears for Fatuma Ali (pm_bench_020 expects 12,500 KES arrears)
  const fatumaLease = await prisma.lease.findFirst({ where: { tenantId: 'tenant-fatuma-001' } });
  if (fatumaLease) {
      // Logic for arrears: total rent due vs total paid. 
      // We could add a penalty or just a partial payment.
      await prisma.penalty.create({
          data: {
              amount: 12500,
              type: 'LATE_PAYMENT',
              status: 'PENDING',
              leaseId: fatumaLease.id,
              description: 'Outstanding arrears from previous month'
          }
      });
  }

  // 7. Maintenance Tickets
  await prisma.maintenanceRequest.create({
    data: {
      title: 'Sink Blockage',
      description: 'Reported high cost issue',
      category: MaintenanceCategory.PLUMBING,
      priority: MaintenancePriority.HIGH,
      status: MaintenanceStatus.REPORTED,
      companyId: companyId,
      propertyId: 'bahari-ridge-001',
      unitId: 'unit-101-bahari',
      actualCost: 3500,
    }
  });

  console.log('Seed completed successfully 🌱');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
