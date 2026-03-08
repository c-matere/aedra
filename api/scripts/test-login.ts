import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    const prismaService = new PrismaService();
    // Patch prismaService for testing if needed... no, it should just connect in script too.
    const authService = new AuthService(prismaService);

    const email = 'admin1@management.co.ke';
    const plainPassword = 'password123';

    try {
        const result = await authService.login(email, plainPassword);
        console.log('AuthService.login SUCCESS:', result.user.email);
    } catch (e) {
        console.error('AuthService.login FAILED:', e.message);
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => pool.end());
