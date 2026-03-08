import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    const companies = await prisma.company.findMany({
        where: { email: 'verifier@test.com' },
        include: { users: true, invitations: true }
    });

    console.log('--- Verification Check ---');
    if (companies.length > 0) {
        const company = companies[0];
        console.log('Company found:', company.name);
        console.log('Admins found:', company.users.length);
        console.log('Invitations found:', company.invitations.length);
        if (company.invitations.length > 0) {
            console.log('Invitation Token:', company.invitations[0].token);
        }
    } else {
        console.log('No test company found. Registration may have failed or not run.');
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => pool.end());
