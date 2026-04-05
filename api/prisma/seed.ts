import {
    PrismaClient,
    UserRole,
    PropertyType,
    MaintenanceCategory,
    MaintenancePriority,
    MaintenanceStatus,
    UnitStatus,
    ExpenseCategory,
    PaymentMethod,
    LeaseStatus,
    InvoiceType
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

const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'Amina', 'Kwame', 'David', 'Fatima', 'Kim', 'Ali', 'Elena', 'Carlos', 'Yuki', 'Sven', 'Zahra', 'Liam', 'Olivia', 'Noah', 'Emma', 'Oliver'];
const lastNames = ['Smith', 'Doe', 'Kamau', 'Wanjiku', 'Mwangi', 'Ali', 'Ochieng', 'Juma', 'Kariuki', 'Abdullah', 'Garcia', 'Chen', 'Tanaka', 'Muller', 'Abadi', 'Wilson', 'Johnson', 'Brown', 'Davis', 'Miller'];
const buildings = ['Plaza', 'Towers', 'Apartments', 'Residency', 'Gardens', 'Heights', 'Views', 'Court', 'Terrace', 'Suites'];
const locations = ['Westlands', 'Kilimani', 'Lavington', 'Nyali', 'Karen', 'Langata', 'Parklands', 'Upper Hill', 'Gigiri', 'South B'];

function getRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
    console.log('Seeding Heavy Database (1000+ records)...');

    const defaultPassword = 'Aedra@2026';
    const hashedDefaultPassword = await bcryptjs.hash(defaultPassword, 10);

    await prisma.$transaction(async (tx) => {
        // Bypass RLS for seeding
        await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', TRUE)`;

        // Clear existing data to avoid unique constraint violations
        await tx.propertyAssignment.deleteMany();
        await tx.role.deleteMany();
        await tx.todoItem.deleteMany();
        await tx.conversationFeedback.deleteMany();
        await tx.maintenanceRequest.deleteMany();
        await tx.expense.deleteMany();
        await tx.income.deleteMany();
        await tx.payment.deleteMany();
        await tx.penalty.deleteMany();
        await tx.invoice.deleteMany();
        await tx.lease.deleteMany();
        await tx.unit.deleteMany();
        await tx.tenant.deleteMany();
        await tx.property.deleteMany();
        await tx.landlord.deleteMany();
        await tx.user.deleteMany({ where: { role: { not: UserRole.SUPER_ADMIN } } });
        await tx.company.deleteMany();

        // 1. Super Admin
        await tx.user.upsert({
            where: { email: 'superadmin@aedra.co.ke' },
            update: {},
            create: {
                email: 'superadmin@aedra.co.ke',
                password: hashedDefaultPassword,
                firstName: 'Aedra',
                lastName: 'Support',
                role: UserRole.SUPER_ADMIN,
                isActive: true,
            },
        });

        await tx.user.upsert({
            where: { email: 'criswafula2@gmail.com' },
            update: {},
            create: {
                email: 'criswafula2@gmail.com',
                password: hashedDefaultPassword,
                firstName: 'Chris',
                lastName: 'Wafula',
                role: UserRole.SUPER_ADMIN,
                isActive: true,
            },
        });

        // 2. Companies
        const companies = [];
        for (let i = 1; i <= 5; i++) {
            const company = await tx.company.create({
                data: {
                    name: `${getRandom(lastNames)} Management No. ${i}`,
                    email: `hello${i}@management.co.ke`,
                    phone: `+2547000000${i}`,
                    address: `${getRandom(locations)}, Kenya`,
                    isActive: true,
                },
            });
            companies.push(company);

            // Admin for each company
            await tx.user.create({
                data: {
                    email: `admin${i}@management.co.ke`,
                    password: hashedDefaultPassword,
                    firstName: getRandom(firstNames),
                    lastName: getRandom(lastNames),
                    role: UserRole.COMPANY_ADMIN,
                    companyId: company.id,
                    isActive: true,
                },
            });
        }

        // 3. Landlords
        const landlords = [];
        for (let i = 0; i < 20; i++) {
            const landlord = await tx.landlord.create({
                data: {
                    firstName: getRandom(firstNames),
                    lastName: getRandom(lastNames),
                    email: `landlord${i}@example.com`,
                    phone: `+2547110000${i}`,
                    idNumber: `ID${1000000 + i}`,
                    companyId: getRandom(companies).id,
                },
            });
            landlords.push(landlord);
        }

        // 4. Properties
        const properties = [];
        for (let i = 0; i < 50; i++) {
            const landlord = getRandom(landlords);
            const property = await tx.property.create({
                data: {
                    name: `${getRandom(lastNames)} ${getRandom(buildings)}`,
                    propertyType: getRandom([PropertyType.RESIDENTIAL, PropertyType.COMMERCIAL, PropertyType.MIXED_USE, PropertyType.INDUSTRIAL, PropertyType.LAND]),
                    address: `${100 + i} ${getRandom(locations)} Way`,
                    latitude: -1.28 + (Math.random() * 0.1),
                    longitude: 36.82 + (Math.random() * 0.1),
                    landlordId: landlord.id,
                    companyId: landlord.companyId!,
                },
            });
            properties.push(property);
        }

        // 5. Units
        const units = [];
        for (const prop of properties) {
            for (let i = 1; i <= 4; i++) {
                const unit = await tx.unit.create({
                    data: {
                        unitNumber: `Apt ${i}${getRandom(['A', 'B', 'C', 'D'])}`,
                        floor: `${getRandom(['Ground', '1st', '2nd', '3rd'])} Floor`,
                        bedrooms: Math.floor(Math.random() * 4) + 1,
                        bathrooms: Math.floor(Math.random() * 3) + 1,
                        sizeSqm: 50 + Math.floor(Math.random() * 150),
                        rentAmount: 30000 + Math.floor(Math.random() * 100000),
                        status: UnitStatus.VACANT,
                        propertyId: prop.id,
                    },
                });
                units.push(unit);
            }
        }

        // 6. Tenants
        const tenantsWithContext = [];
        for (let i = 0; i < 200; i++) {
            const unit = units[i % units.length];
            const property = properties.find(p => p.id === unit.propertyId)!;
            const tenant = await tx.tenant.create({
                data: {
                    firstName: getRandom(firstNames),
                    lastName: getRandom(lastNames),
                    email: `tenant${i}@example.com`,
                    phone: `+2547220000${i}`,
                    idNumber: `TID${2000000 + i}`,
                    companyId: property.companyId!,
                    propertyId: property.id,
                },
            });
            tenantsWithContext.push({ tenant, unit, property });

            await tx.unit.update({
                where: { id: unit.id },
                data: { status: UnitStatus.OCCUPIED }
            });
        }

        // 7. Leases & Payments
        for (let i = 0; i < tenantsWithContext.length; i++) {
            const { tenant, unit, property } = tenantsWithContext[i];
            const lease = await tx.lease.create({
                data: {
                    startDate: new Date('2026-01-01'),
                    endDate: new Date('2026-12-31'),
                    rentAmount: unit.rentAmount!,
                    deposit: unit.rentAmount!,
                    status: LeaseStatus.ACTIVE,
                    propertyId: property.id,
                    unitId: unit.id,
                    tenantId: tenant.id,
                },
            });

            // 8. Invoices & Payments
            // Create Security Deposit Invoice
            if (lease.deposit && lease.deposit > 0) {
                await tx.invoice.create({
                    data: {
                        amount: lease.deposit,
                        description: 'Security Deposit',
                        type: InvoiceType.OTHER,
                        dueDate: lease.startDate,
                        status: 'PAID',
                        leaseId: lease.id,
                        createdAt: lease.startDate
                    }
                });
            }

            for (let j = 1; j <= 2; j++) {
                const paidAt = new Date(2026, j, 5);
                // Create Rent Invoice
                await tx.invoice.create({
                    data: {
                        amount: unit.rentAmount!,
                        description: `Rent Invoice - ${paidAt.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
                        type: InvoiceType.RENT,
                        dueDate: paidAt,
                        status: 'PAID',
                        leaseId: lease.id,
                        createdAt: paidAt
                    }
                });

                // Create Payment
                await tx.payment.create({
                    data: {
                        amount: unit.rentAmount!,
                        paidAt,
                        method: getRandom([PaymentMethod.MPESA, PaymentMethod.BANK_TRANSFER, PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.CHEQUE]),
                        reference: `REF-L${i}-P${j}`,
                        leaseId: lease.id,
                    }
                });
            }
        }

        // 9. Maintenance Requests
        for (let i = 0; i < 100; i++) {
            const prop = getRandom(properties);
            const unit = units.find(u => u.propertyId === prop.id);
            await tx.maintenanceRequest.create({
                data: {
                    title: `${getRandom(['Leaking', 'Broken', 'Needs painting', 'Electrical issue'])} in ${getRandom(['Kitchen', 'Bathroom', 'Bedroom'])}`,
                    description: 'Issue reported by tenant, needs urgent attention.',
                    category: getRandom([MaintenanceCategory.PLUMBING, MaintenanceCategory.ELECTRICAL, MaintenanceCategory.GENERAL, MaintenanceCategory.STRUCTURAL, MaintenanceCategory.PAINTING, MaintenanceCategory.PEST_CONTROL]),
                    priority: getRandom([MaintenancePriority.LOW, MaintenancePriority.MEDIUM, MaintenancePriority.HIGH, MaintenancePriority.URGENT]),
                    status: getRandom([MaintenanceStatus.REPORTED, MaintenanceStatus.ACKNOWLEDGED, MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.COMPLETED]),
                    companyId: prop.companyId!,
                    propertyId: prop.id,
                    unitId: unit?.id,
                },
            });
        }

        // 10. Expenses
        for (let i = 0; i < 100; i++) {
            const prop = getRandom(properties);
            await tx.expense.create({
                data: {
                    description: `${getRandom(['Garbage', 'Security', 'Maintenance', 'Cleaning'])} Fees`,
                    amount: 5000 + Math.floor(Math.random() * 20000),
                    date: new Date(),
                    category: getRandom([ExpenseCategory.UTILITY, ExpenseCategory.MAINTENANCE, ExpenseCategory.SECURITY, ExpenseCategory.CLEANING, ExpenseCategory.MANAGEMENT_FEE]),
                    companyId: prop.companyId!,
                    propertyId: prop.id,
                },
            });
        }
    }, { timeout: 60000 });

    console.log('Heavy Seed completed successfully 🌱 (~1200+ records created)');
}

main()
    .catch((e) => {
        console.error('SEED ERROR:');
        console.dir(e, { depth: null });
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
