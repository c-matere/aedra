import { PrismaClient, UserRole, PropertyType, UnitStatus, LeaseStatus, PaymentMethod } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding PM-Bench specific records...');

  // 1. Benchmark Company
  const company = await prisma.company.upsert({
    where: { id: 'bench-company-001' },
    update: { name: 'Benchmark Management Corp' },
    create: {
      id: 'bench-company-001',
      name: 'Benchmark Management Corp',
      isActive: true,
    },
  });

  // 2. Palm Grove Property
  const property = await prisma.property.create({
    data: {
      name: 'Palm Grove',
      propertyType: PropertyType.RESIDENTIAL,
      address: '123 Palm Drive, Mombasa',
      companyId: company.id,
    },
  });

  // 3. Fatuma Ali (Arrears Scenario 020)
  const fatuma = await prisma.tenant.create({
    data: {
      firstName: 'Fatuma',
      lastName: 'Ali',
      email: 'fatuma@example.com',
      companyId: company.id,
      propertyId: property.id,
    },
  });

  const unitB4 = await prisma.unit.create({
    data: {
      unitNumber: 'B4',
      status: UnitStatus.OCCUPIED,
      propertyId: property.id,
      rentAmount: 45000,
    },
  });

  const leaseFatuma = await prisma.lease.create({
    data: {
      tenantId: fatuma.id,
      unitId: unitB4.id,
      propertyId: property.id,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      rentAmount: 45000,
      status: LeaseStatus.ACTIVE,
    },
  });

  // Arrears for Fatuma: 12,500
  await prisma.invoice.create({
    data: {
      leaseId: leaseFatuma.id,
      amount: 12500,
      description: 'Arrears Balance',
      dueDate: new Date(),
      status: 'PENDING',
    },
  });

  // 4. John Mwangi (Scenario 021/Financial)
  const john = await prisma.tenant.create({
    data: {
      firstName: 'John',
      lastName: 'Mwangi',
      email: 'john@example.com',
      companyId: company.id,
      propertyId: property.id,
    },
  });

  const unitA1 = await prisma.unit.create({
    data: {
      unitNumber: 'A1',
      status: UnitStatus.OCCUPIED,
      propertyId: property.id,
      rentAmount: 30000,
    },
  });

  const leaseJohn = await prisma.lease.create({
    data: {
      tenantId: john.id,
      unitId: unitA1.id,
      propertyId: property.id,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      rentAmount: 30000,
      status: LeaseStatus.ACTIVE,
    },
  });

  // Arrears for John: 12,500
  await prisma.invoice.create({
    data: {
      leaseId: leaseJohn.id,
      amount: 12500,
      description: 'Partial Pending Rent',
      dueDate: new Date(),
      status: 'PENDING',
    },
  });

  // 5. Unit C2 for Maintenance (Scenario 019/021)
  await prisma.unit.create({
    data: {
      unitNumber: 'C2',
      status: UnitStatus.OCCUPIED,
      propertyId: property.id,
      rentAmount: 35000,
    },
  });

  console.log('✅ PM-Bench Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
