import { PrismaClient, UserRole, PropertyType, UnitStatus, LeaseStatus, PenaltyType, PenaltyStatus } from '@prisma/client';
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
    console.log('🌱 Seeding Consolidated Benchmark Data (v2)...');

    const defaultPassword = 'Aedra@2026';
    const hashedDefaultPassword = await bcryptjs.hash(defaultPassword, 10);

    // 1. Companies
    const company = await prisma.company.upsert({
        where: { id: 'bench-company-001' },
        update: { name: 'Aedra Realty' },
        create: {
            id: 'bench-company-001',
            name: 'Aedra Realty',
            email: 'info@aedra.co.ke',
        }
    });

    // 1.1 Link Benchmark User to Company for Visibility
    await prisma.user.upsert({
        where: { id: '3a33e9db-4e47-4ede-87d0-b4978f455b12' },
        update: {
            role: UserRole.SUPER_ADMIN,
            companyId: company.id,
            isActive: true,
        },
        create: {
            id: '3a33e9db-4e47-4ede-87d0-b4978f455b12',
            email: 'criswafula2@gmail.com',
            password: hashedDefaultPassword,
            firstName: 'Chris',
            lastName: 'Wafula',
            role: UserRole.SUPER_ADMIN,
            companyId: company.id,
            isActive: true,
        },
    });

    // 2. Landlord
    const peter = await prisma.landlord.upsert({
        where: { id: 'bench-landlord-peter' },
        update: {},
        create: {
            id: 'bench-landlord-peter',
            firstName: 'Peter',
            lastName: 'Otieno',
            email: 'peter.otieno@example.com',
            companyId: company.id,
        }
    });

    // 3. Property (Palm Grove - Exactly as in bench)
    const palmGrove = await prisma.property.upsert({
        where: { id: 'bench-prop-palmgrove' },
        update: {
            name: 'Palm Grove',
            description: 'Luxury residential estate in Mombasa. POLICY: 30-day (one month) notice period required for move-out. Termination before lease end attracts a 1-month rent penalty fee.'
        },
        create: {
            id: 'bench-prop-palmgrove',
            name: 'Palm Grove',
            propertyType: PropertyType.RESIDENTIAL,
            address: '123 Palm Drive, Mombasa',
            description: 'Luxury residential estate in Mombasa. POLICY: 30-day (one month) notice period required for move-out. Termination before lease end attracts a 1-month rent penalty fee.',
            landlordId: peter.id,
            companyId: company.id,
        }
    });

    // 4. Units
    const units = [
        { id: 'bench-unit-a1', num: 'A1', rent: 30000 },
        { id: 'bench-unit-b4', num: 'B4', rent: 45000 },
        { id: 'bench-unit-c2', num: 'C2', rent: 35000 },
        { id: 'bench-unit-204', num: '204', rent: 40000 },
        { id: 'bench-unit-a0', num: 'A0', rent: 25000 },
    ];

    for (const u of units) {
        await prisma.unit.upsert({
            where: { id: u.id },
            update: { unitNumber: u.num, rentAmount: u.rent, propertyId: palmGrove.id },
            create: {
                id: u.id,
                unitNumber: u.num,
                rentAmount: u.rent,
                status: UnitStatus.OCCUPIED,
                propertyId: palmGrove.id,
            }
        });
    }

    // 5. Tenants
    const john = await prisma.tenant.upsert({
        where: { id: 'bench-tenant-john' },
        update: { firstName: 'John', lastName: 'Mwangi' },
        create: {
            id: 'bench-tenant-john',
            firstName: 'John',
            lastName: 'Mwangi',
            email: 'john.mwangi@example.com',
            companyId: company.id,
            propertyId: palmGrove.id,
        }
    });

    const fatuma = await prisma.tenant.upsert({
        where: { id: 'bench-tenant-fatuma' },
        update: { firstName: 'Fatuma', lastName: 'Ali' },
        create: {
            id: 'bench-tenant-fatuma',
            firstName: 'Fatuma',
            lastName: 'Ali',
            email: 'fatuma.ali@example.com',
            companyId: company.id,
            propertyId: palmGrove.id,
        }
    });

    const karibu = await prisma.tenant.upsert({
        where: { id: 'bench-tenant-karibu' },
        update: { firstName: 'Karibu', lastName: 'Tenant' },
        create: {
            id: 'bench-tenant-karibu',
            firstName: 'Karibu',
            lastName: 'Tenant',
            email: 'karibu@aedra.co.ke',
            companyId: company.id,
            propertyId: palmGrove.id,
        }
    });

    // 6. Leases
    const johnLease = await prisma.lease.upsert({
        where: { id: 'bench-lease-john' },
        update: {},
        create: {
            id: 'bench-lease-john',
            startDate: new Date('2026-01-01'),
            endDate: new Date('2026-12-31'),
            rentAmount: 30000,
            status: LeaseStatus.ACTIVE,
            propertyId: palmGrove.id,
            unitId: 'bench-unit-a1',
            tenantId: john.id,
        }
    });

    const fatumaLease = await prisma.lease.upsert({
        where: { id: 'bench-lease-fatuma' },
        update: {},
        create: {
            id: 'bench-lease-fatuma',
            startDate: new Date('2026-01-01'),
            endDate: new Date('2026-12-31'),
            rentAmount: 45000,
            status: LeaseStatus.ACTIVE,
            propertyId: palmGrove.id,
            unitId: 'bench-unit-b4',
            tenantId: fatuma.id,
        }
    });

    const karibuLease = await prisma.lease.upsert({
        where: { id: 'bench-lease-karibu' },
        update: {},
        create: {
            id: 'bench-lease-karibu',
            startDate: new Date('2026-01-01'),
            endDate: new Date('2026-12-31'),
            rentAmount: 35000,
            status: LeaseStatus.ACTIVE,
            propertyId: palmGrove.id,
            unitId: 'bench-unit-c2',
            tenantId: karibu.id,
        }
    });

    // 7. Arrears (Invoices)
    await prisma.invoice.upsert({
        where: { id: 'bench-inv-fatuma' },
        update: { amount: 12500 },
        create: {
            id: 'bench-inv-fatuma',
            leaseId: fatumaLease.id,
            amount: 12500,
            description: 'Arrears Balance',
            dueDate: new Date(),
            status: 'PENDING'
        }
    });

    await prisma.invoice.upsert({
        where: { id: 'bench-inv-john' },
        update: { amount: 12500 },
        create: {
            id: 'bench-inv-john',
            leaseId: johnLease.id,
            amount: 12500,
            description: 'Partial Pending Rent',
            dueDate: new Date(),
            status: 'PENDING'
        }
    });

    // 8. Penalty for Karibu (Move-out context)
    await prisma.penalty.upsert({
        where: { id: 'bench-penalty-karibu' },
        update: { amount: 35000 },
        create: {
            id: 'bench-penalty-karibu',
            leaseId: karibuLease.id,
            type: PenaltyType.EARLY_TERMINATION,
            amount: 35000,
            description: 'Early termination penalty (1 month rent). Note: 30-day notice period required.',
            status: PenaltyStatus.PENDING,
        }
    });

    console.log('✅ Consolidated Benchmark Seed (v2) Success!');
}

main()
    .catch((e) => {
        console.error('❌ SEED ERROR:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
