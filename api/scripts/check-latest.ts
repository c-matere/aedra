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
    const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { company: true }
    });

    console.log('--- Latest Users ---');
    users.forEach(u => console.log(`${u.email} (${u.role}) - Company: ${u.company?.name}`));

    const invites = await prisma.invitation.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
    });

    console.log('\n--- Latest Invitations ---');
    invites.forEach(i => console.log(`${i.email} - Token: ${i.token}`));
}

main()
    .catch(e => console.error(e))
    .finally(() => pool.end());
