import { PrismaClient } from '@prisma/client';
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
    const email = 'admin1@management.co.ke';
    const plainPassword = 'Aedra@2026';

    const user = await prisma.user.findUnique({
        where: { email }
    });

    if (!user) {
        console.log('User not found');
        return;
    }

    console.log('User found:', user.email);
    console.log('Hash in DB:', user.password);

    const isValid = await bcryptjs.compare(plainPassword, user.password);
    console.log('bcryptjs.compare result:', isValid);

    // Also check if we can generate the same hash (unlikely because of salt, but worth a try with same salt if possible... wait, just checking if hash format is right)
    console.log('Starts with $2:', user.password.startsWith('$2'));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
