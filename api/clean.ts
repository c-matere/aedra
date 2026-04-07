import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function clean() {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const rawCode = '0705660625';
    const cleanCode = '254705660625';

    console.log('--- CLEANUP SCRIPT ---');

    await prisma.$executeRawUnsafe(`DELETE FROM "ChatMessage" WHERE "chatHistoryId" IN (SELECT id FROM "ChatHistory" WHERE "waPhone" LIKE '%0705660625%' OR "waPhone" LIKE '%254705660625%')`);
    await prisma.$executeRawUnsafe(`DELETE FROM "ChatHistory" WHERE "waPhone" LIKE '%0705660625%' OR "waPhone" LIKE '%254705660625%'`);
    await prisma.$executeRawUnsafe(`DELETE FROM "Tenant" WHERE "phone" LIKE '%0705660625%' OR "phone" LIKE '%254705660625%'`);
    await prisma.$executeRawUnsafe(`DELETE FROM "Landlord" WHERE "phone" LIKE '%0705660625%' OR "phone" LIKE '%254705660625%'`);
    
    // We must unlink Company from User before deleting User, there is NO Staff table
    // Company doesn't strictly link to User, but User links to Company via companyId. So we don't need to touch Company.
    
    // We must unlink TodoItem from User before deleting User
    await prisma.$executeRawUnsafe(`DELETE FROM "TodoItem" WHERE "userId" IN (SELECT id FROM "User" WHERE "phone" LIKE '%0705660625%' OR "phone" LIKE '%254705660625%')`);
    // Unlink PropertyAssignment
    await prisma.$executeRawUnsafe(`DELETE FROM "PropertyAssignment" WHERE "userId" IN (SELECT id FROM "User" WHERE "phone" LIKE '%0705660625%' OR "phone" LIKE '%254705660625%')`);
    
    const u = await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE "phone" LIKE '%0705660625%' OR "phone" LIKE '%254705660625%'`);

    console.log(`✅ Success! Erased records.`);

  } catch (e) {
    console.error('Failed:', e);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

clean();
