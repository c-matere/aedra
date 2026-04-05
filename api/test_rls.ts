import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

async function testRegistration() {
  const connectionString = "postgresql://postgres:postgres@localhost:4543/aedra";
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    console.log("Attempting to create company with RLS set to unidentified...");
    
    // Simulate what PrismaService does
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', '', TRUE)`;
      await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'false', TRUE)`;
      await tx.$executeRaw`SELECT set_config('app.current_user_id', 'unidentified', TRUE)`;

      const company = await tx.company.create({
        data: {
          name: "Test Company Registration",
          email: "test@example.com",
          isActive: true,
        },
      });
      console.log("Success! Company created:", company.id);
    });
  } catch (e) {
    console.error("Failed to create company:", e.message);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

testRegistration();
