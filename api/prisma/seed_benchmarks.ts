import {
    PrismaClient,
    UserRole,
    PropertyType,
    UnitStatus,
    LeaseStatus
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
    console.log('🌱 Seeding Benchmark Sandbox Data...');

    const defaultPassword = 'Aedra@2026';
    const hashedDefaultPassword = await bcryptjs.hash(defaultPassword, 10);

    // 1. Benchmark Super Admin (Using existing user with this ID)
    await prisma.user.upsert({
        where: { id: '3a33e9db-4e47-4ede-87d0-b4978f455b12' },
        update: {
            role: UserRole.SUPER_ADMIN,
            isActive: true,
        },
        create: {
            id: '3a33e9db-4e47-4ede-87d0-b4978f455b12',
            email: 'criswafula2@gmail.com',
            password: hashedDefaultPassword,
            firstName: 'Chris',
            lastName: 'Wafula',
            role: UserRole.SUPER_ADMIN,
            isActive: true,
        },
    });

    // 2. Companies
    await prisma.company.upsert({
        where: { id: 'bench-company-001' },
        update: { name: 'Aedra Realty' },
        create: {
            id: 'bench-company-001',
            name: 'Aedra Realty',
            email: 'info@aedra.co.ke',
        }
    });

    // 3. Landlords
    const peter = await prisma.landlord.upsert({
        where: { id: 'bench-landlord-peter' },
        update: {},
        create: {
            id: 'bench-landlord-peter',
            firstName: 'Peter',
            lastName: 'Otieno',
            email: 'peter.otieno@example.com',
            companyId: 'bench-company-001',
        }
    });

    // 4. Properties
    const palmsGrove = await prisma.property.upsert({
        where: { id: 'bench-prop-palmsgrove' },
        update: {},
        create: {
            id: 'bench-prop-palmsgrove',
            name: 'Palms Grove',
            propertyType: PropertyType.RESIDENTIAL,
            landlordId: peter.id,
            companyId: 'bench-company-001',
        }
    });

    // 5. Units
    await prisma.unit.upsert({
        where: { id: 'bench-unit-a1' },
        update: {},
        create: {
            id: 'bench-unit-a1',
            unitNumber: 'A1',
            propertyId: palmsGrove.id,
            rentAmount: 50000,
            status: UnitStatus.OCCUPIED,
        }
    });

    await prisma.unit.upsert({
        where: { id: 'bench-unit-b4' },
        update: {},
        create: {
            id: 'bench-unit-b4',
            unitNumber: 'B4',
            propertyId: palmsGrove.id,
            rentAmount: 45000,
            status: UnitStatus.OCCUPIED,
        }
    });

    // 6. Tenants
    const mary = await prisma.tenant.upsert({
        where: { id: 'bench-tenant-mary' },
        update: {},
        create: {
            id: 'bench-tenant-mary',
            firstName: 'Mary',
            lastName: 'Atieno',
            phone: '254700000001',
            companyId: 'bench-company-001',
            propertyId: palmsGrove.id,
        }
    });

    const john = await prisma.tenant.upsert({
        where: { id: 'bench-tenant-john' },
        update: {},
        create: {
            id: 'bench-tenant-john',
            firstName: 'John',
            lastName: 'Doe',
            phone: '254700000002',
            companyId: 'bench-company-001',
            propertyId: palmsGrove.id,
        }
    });

    // 7. Leases
    const maryLease = await prisma.lease.upsert({
        where: { id: 'bench-lease-mary' },
        update: {},
        create: {
            id: 'bench-lease-mary',
            startDate: new Date('2026-01-01'),
            endDate: new Date('2026-12-31'),
            rentAmount: 50000,
            status: LeaseStatus.ACTIVE,
            propertyId: palmsGrove.id,
            unitId: 'bench-unit-a1',
            tenantId: mary.id,
        }
    });

    // 8. Maintenance Requests
    await prisma.maintenanceRequest.upsert({
        where: { id: 'bench-maint-sink' },
        update: {},
        create: {
            id: 'bench-maint-sink',
            unitId: 'bench-unit-a1',
            propertyId: palmsGrove.id,
            companyId: 'bench-company-001',
            category: 'PLUMBING',
            title: 'Sink repair',
            description: 'sink repair',
            status: 'COMPLETED',
            priority: 'HIGH',
            notes: 'Photos: https://example.com/before-sink.jpg (before), https://example.com/after-sink.jpg (after)'
        }
    });

    // 9. Invoices and Payments
    const invoice = await prisma.invoice.upsert({
        where: { id: 'bench-inv-001' },
        update: {},
        create: {
            id: 'bench-inv-001',
            leaseId: maryLease.id,
            amount: 50000,
            description: 'Rent for March 2026',
            dueDate: new Date(),
            status: 'PAID'
        }
    });

    await prisma.payment.upsert({
        where: { id: 'bench-pay-001' },
        update: {},
        create: {
            id: 'bench-pay-001',
            leaseId: 'bench-lease-mary',
            amount: 50000.0,
            method: 'MPESA',
            reference: 'MP7896',
            paidAt: new Date(),
        }
    });

    // 10. Expenses
    await prisma.expense.upsert({
        where: { id: 'bench-exp-001' },
        update: {},
        create: {
            id: 'bench-exp-001',
            propertyId: palmsGrove.id,
            companyId: 'bench-company-001',
            amount: 5000,
            category: 'MAINTENANCE',
            description: 'Sink repair parts',
            date: new Date()
        }
    });

    console.log('✅ Benchmark Seed Success!');
}

main()
    .catch((e) => {
        console.error('❌ SEED ERROR:', e);
        if (e.cause) console.error('🔍 CAUSE:', e.cause);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
