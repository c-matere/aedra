import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
    const companyId = 'bench-company-001';
    
    console.log('--- TESTING UNITS ---');
    const units = await prisma.unit.findMany({
        where: { property: { companyId } },
        include: { property: true }
    });
    console.log('Units found:', units.map(u => `${u.unitNumber} (${u.id}) - Property: ${u.property.name}`));

    console.log('\n--- TESTING TENANTS ---');
    const tenants = await prisma.tenant.findMany({
        where: { companyId }
    });
    console.log('Tenants found:', tenants.map(t => `${t.firstName} ${t.lastName} (${t.id})`));

    console.log('\n--- TESTING LEASES ---');
    const leases = await prisma.lease.findMany({
        where: { property: { companyId } },
        include: { tenant: true, unit: true }
    });
    console.log('Leases found:', leases.map(l => `Tenant: ${l.tenant.firstName}, Unit: ${l.unit?.unitNumber}, ID: ${l.id}`));

    console.log('\n--- TESTING INVOICES ---');
    const invoices = await prisma.invoice.findMany({
        where: { lease: { property: { companyId } } },
        include: { lease: { include: { tenant: true } } }
    });
    console.log('Invoices found:', invoices.map(i => `Tenant: ${i.lease.tenant.firstName}, Amount: ${i.amount}, Status: ${i.status}`));
}

test().finally(() => prisma.$disconnect());
