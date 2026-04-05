import { PrismaClient, UserRole } from '@prisma/client';

async function verifyIsolation() {
  const prisma = new PrismaClient();
  
  try {
    console.log('--- ADVANCED RBAC ISOLATION TEST ---');

    // 1. Get a test company and its properties
    const company = await prisma.company.findFirst({
      where: { name: 'Bench Property Management' },
      include: { properties: true }
    });

    if (!company || company.properties.length < 2) {
      console.error('Test requires a company with at least 2 properties.');
      return;
    }

    const prop1 = company.properties[0];
    const prop2 = company.properties[1];

    // 2. Get/Create a test staff user
    const staffUser = await prisma.user.upsert({
      where: { email: 'staff-test@aedra.co.ke' },
      update: { role: UserRole.COMPANY_STAFF, companyId: company.id },
      create: {
        email: 'staff-test@aedra.co.ke',
        firstName: 'Staff',
        lastName: 'Test',
        password: 'password123',
        role: UserRole.COMPANY_STAFF,
        companyId: company.id
      }
    });

    console.log(`Testing with staff user: ${staffUser.email}`);

    // 3. Assign staff to ONLY Prop 1
    await prisma.propertyAssignment.deleteMany({ where: { userId: staffUser.id } });
    await prisma.propertyAssignment.create({
      data: {
        userId: staffUser.id,
        propertyId: prop1.id,
        companyId: company.id
      }
    });

    console.log(`Assigned staff to property: ${prop1.name}`);

    // 4. Simulate a database session with RLS variables for the staff user
    // We must use a transaction to keep session variables alive for the query
    const results = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${company.id}, TRUE)`;
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${staffUser.id}, TRUE)`;
      await tx.$executeRaw`SELECT set_config('app.current_role', ${UserRole.COMPANY_STAFF}, TRUE)`;
      await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'false', TRUE)`;

      const visibleProperties = await tx.property.findMany();
      return visibleProperties;
    });

    console.log(`Visible properties: ${results.length}`);
    results.forEach(p => console.log(` - ${p.name}`));

    // 5. Assertions
    const isIsolated = results.length === 1 && results[0].id === prop1.id;
    if (isIsolated) {
      console.log('✅ ISOLATION TEST PASSED: Staff can only see assigned property.');
    } else {
      console.error('❌ ISOLATION TEST FAILED: Staff sees incorrect property set.');
    }

  } catch (e) {
    console.error('Error during verification:', e);
  } finally {
    await prisma.$disconnect();
  }
}

verifyIsolation();
