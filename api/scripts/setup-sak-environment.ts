import {
    PrismaClient,
    UserRole
} from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import * as bcryptjs from 'bcryptjs';

dotenv.config();

async function main() {
    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    console.log('--- Database Reset Starting ---');

    // Deletion order to respect foreign key constraints
    const tables = [
        'auditLog',
        'workflowStep',
        'workflowInstance',
        'todoItem',
        'conversationFeedback',
        'chatMessage',
        'chatHistory',
        'whatsAppLog',
        'authorizationRequest',
        'maintenanceRequest',
        'expense',
        'invoice',
        'penalty',
        'payment',
        'income',
        'document',
        'lease',
        'unit',
        'tenant',
        'propertyAssignment',
        'property',
        'landlord',
        'invitation',
        'role'
    ];

    try {
        for (const table of tables) {
            if ((prisma as any)[table]) {
                console.log(`Clearing ${table}...`);
                await (prisma as any)[table].deleteMany();
            }
        }

        console.log('Clearing users (excluding Super Admins)...');
        await prisma.user.deleteMany({
            where: {
                role: {
                    notIn: [UserRole.SUPER_ADMIN]
                }
            }
        });

        console.log('Clearing companies...');
        await prisma.company.deleteMany();

        console.log('--- Creating SAK Company ---');
        const company = await prisma.company.create({
            data: {
                name: 'SAK',
                email: 'hello@sak.co.ke',
                isActive: true,
            }
        });
        console.log(`SUCCESS: Company "SAK" created with ID: ${company.id}`);

        console.log('--- Creating Company Admin ---');
        const hashedPassword = await bcryptjs.hash('Aedra@2026', 10);
        const user = await prisma.user.create({
            data: {
                email: 'entorach@gmail.com',
                password: hashedPassword,
                firstName: 'SAK',
                lastName: 'Admin',
                role: UserRole.COMPANY_ADMIN,
                companyId: company.id,
                isActive: true,
            }
        });
        console.log(`SUCCESS: Admin "entorach@gmail.com" created with ID: ${user.id}`);
        
        console.log('\n--- SETUP COMPLETE ---');
        console.log(`NEW_COMPANY_ID=${company.id}`);

    } catch (error: any) {
        console.error('CRITICAL ERROR DURING SETUP:', error.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

main();
