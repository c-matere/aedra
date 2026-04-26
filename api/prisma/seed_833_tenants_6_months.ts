import {
    PrismaClient,
    UserRole,
    PropertyType,
    UnitStatus,
    LeaseStatus,
    PaymentMethod,
    InvoiceType
} from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import * as bcryptjs from 'bcryptjs';

dotenv.config({ path: '/home/chris/aedra/api/.env' });

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'Amina', 'Kwame', 'David', 'Fatima', 'Kim', 'Ali', 'Elena', 'Carlos', 'Yuki', 'Sven', 'Zahra', 'Liam', 'Olivia', 'Noah', 'Emma', 'Oliver', 'Peter', 'Grace', 'Samuel', 'Brian', 'Hassan', 'Rose', 'Omari', 'Zari', 'Kamau', 'Amani'];
const lastNames = ['Smith', 'Doe', 'Kamau', 'Wanjiku', 'Mwangi', 'Ali', 'Ochieng', 'Juma', 'Kariuki', 'Abdullah', 'Garcia', 'Chen', 'Tanaka', 'Muller', 'Abadi', 'Wilson', 'Johnson', 'Brown', 'Davis', 'Miller', 'Otieno', 'Wambui', 'Omondi', 'Maina', 'Kipkorir', 'Kibet', 'Cheruiyot', 'Mutua', 'Musyoka'];

function getRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
    console.log('🚀 Seeding 833 Tenants with 6 Months of Historical Data...');

    const companyName = 'Aedra Strategic Portfolio (833 Tenants)';
    const companyId = 'stress-test-company-833';
    const propertyId = 'stress-test-prop-palm-heights';
    const hashedDefaultPassword = await bcryptjs.hash('Aedra@2026', 10);

    // 1. Create/Upsert Company
    const company = await prisma.company.upsert({
        where: { id: companyId },
        update: { name: companyName },
        create: {
            id: companyId,
            name: companyName,
            email: 'portfolio@aedra.co.ke',
            isActive: true,
        }
    });

    // 2. Link Admin
    const adminEmail = 'criswafula2@gmail.com';
    await prisma.user.upsert({
        where: { email: adminEmail },
        update: { companyId: company.id },
        create: {
            email: adminEmail,
            password: hashedDefaultPassword,
            firstName: 'Chris',
            lastName: 'Wafula',
            role: UserRole.SUPER_ADMIN,
            companyId: company.id,
            isActive: true,
        }
    });

    // 3. Create Property
    await prisma.property.upsert({
        where: { id: propertyId },
        update: { name: 'Palm Heights Estate' },
        create: {
            id: propertyId,
            name: 'Palm Heights Estate',
            propertyType: PropertyType.RESIDENTIAL,
            address: 'Nyali, Mombasa',
            companyId: company.id,
        }
    });

    console.log('Generating 833 Tenants and Leases...');

    const TOTAL_TENANTS = 833;
    const MONTHS_BACK = 6;
    const startingDate = new Date('2025-11-01');

    // To speed up, we'll process in chunks
    const CHUNK_SIZE = 50;
    
    for (let i = 0; i < TOTAL_TENANTS; i += CHUNK_SIZE) {
        const currentChunkSize = Math.min(CHUNK_SIZE, TOTAL_TENANTS - i);
        console.log(`Processing chunk ${i / CHUNK_SIZE + 1} (${i} to ${i + currentChunkSize})...`);
        
        await prisma.$transaction(async (tx) => {
            for (let j = 0; j < currentChunkSize; j++) {
                const index = i + j;
                const tenantId = `tenant-stress-${index}`;
                const unitId = `unit-stress-${index}`;
                const leaseId = `lease-stress-${index}`;
                const rentAmount = 30000 + (Math.floor(Math.random() * 11) * 5000); // 30k to 80k in 5k steps

                // Create Unit
                await tx.unit.upsert({
                    where: { id: unitId },
                    update: {},
                    create: {
                        id: unitId,
                        unitNumber: `${Math.floor(index / 10) + 1}${String.fromCharCode(65 + (index % 10))}`,
                        status: UnitStatus.OCCUPIED,
                        propertyId: propertyId,
                        rentAmount: rentAmount,
                    }
                });

                // Create Tenant
                await tx.tenant.upsert({
                    where: { id: tenantId },
                    update: {},
                    create: {
                        id: tenantId,
                        firstName: getRandom(firstNames),
                        lastName: getRandom(lastNames),
                        email: `tenant${index}@stress-test.com`,
                        phone: `+254700000${String(index).padStart(3, '0')}`,
                        companyId: companyId,
                        propertyId: propertyId,
                    }
                });

                // Create Lease
                await tx.lease.upsert({
                    where: { id: leaseId },
                    update: {},
                    create: {
                        id: leaseId,
                        startDate: startingDate,
                        endDate: new Date('2026-10-31'),
                        rentAmount: rentAmount,
                        status: LeaseStatus.ACTIVE,
                        propertyId: propertyId,
                        unitId: unitId,
                        tenantId: tenantId,
                    }
                });

                // 6 Months of data
                for (let m = 0; m < MONTHS_BACK; m++) {
                    const invoiceDate = new Date(startingDate);
                    invoiceDate.setMonth(startingDate.getMonth() + m);
                    
                    const invoiceId = `inv-stress-${index}-m${m}`;
                    const paymentId = `pay-stress-${index}-m${m}`;
                    
                    // 95% collection rate simulation
                    const isPaid = Math.random() < 0.95;
                    const paymentDate = new Date(invoiceDate);
                    paymentDate.setDate(5 + Math.floor(Math.random() * 10)); // Paid between 5th and 15th

                    // Create Invoice
                    await tx.invoice.upsert({
                        where: { id: invoiceId },
                        update: {},
                        create: {
                            id: invoiceId,
                            amount: rentAmount,
                            description: `Rent - ${invoiceDate.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
                            dueDate: invoiceDate,
                            status: isPaid ? 'PAID' : 'PENDING',
                            leaseId: leaseId,
                            type: InvoiceType.RENT,
                            companyId: companyId,
                            createdAt: invoiceDate,
                        }
                    });

                    if (isPaid) {
                        // Create Payment
                        await tx.payment.upsert({
                            where: { id: paymentId },
                            update: {},
                            create: {
                                id: paymentId,
                                amount: rentAmount,
                                paidAt: paymentDate,
                                method: PaymentMethod.MPESA,
                                reference: `MS${index}T${m}XYZ`,
                                leaseId: leaseId,
                                createdAt: paymentDate,
                            }
                        });
                    }
                }
            }
        }, { timeout: 60000 });
    }

    console.log('✅ Seeding completed successfully!');
    console.log(`Summary:`);
    console.log(`- Company: ${companyName}`);
    log(`- Tenants: 833`);
    console.log(`- Historical Period: 6 Months`);
    console.log(`- Total Records: ~10,000`);
}

function log(msg: string) {
    console.log(msg);
}

main()
    .catch((e) => {
        console.error('❌ SEED ERROR:');
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
