import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { InvoicesService } from '../src/invoices/invoices.service';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  
  // Instantiate service 
  // (Note: we use the prisma client directly for simplicity in a script)
  const invoicesService = new InvoicesService(
    prisma as any,
    { sendInvoiceNotice: async () => ({}) } as any, // Mocked WhatsApp
    { sendSms: async () => ({}) } as any, // Mocked SMS
  );
  
  const actor = {
    id: 'system',
    role: 'SUPER_ADMIN',
    companyId: 'e673537b-5249-472f-b209-e09f12b23db4'
  } as any;

  const propertyIds = ["001", "0011", "0019", "0021", "0023", "0024", "0026", "0027", "0030", "00331", "0035", "00036", "0037"];
  
  console.log('Generating monthly invoices and reconciling income...');

  for (const id of propertyIds) {
    // Generate deterministic UUID for the property to match what was imported
    // Wait, the import script used toUUID('property', id)
    const propertyUUID = [
        'property',
        id
    ].join('-'); // Simplified for lookup or I can just find properties for the company

    // Better: find properties for the company and process them all
  }

  const properties = await prisma.property.findMany({
    where: { companyId: actor.companyId }
  });

  console.log(`Processing ${properties.length} properties...`);

  for (const prop of properties) {
    console.log(`\nProperty: ${prop.name} (${prop.id})`);
    
    try {
      // 1. Generate Invoices
      const genResult = await invoicesService.generateMonthlyInvoices(actor, prop.id);
      console.log(`Generated ${genResult.createdCount} invoices.`);

      // 2. Reconcile Income
      const recResult = await invoicesService.autoReconcileIncome(actor, prop.id);
      console.log(`Reconciled ${recResult.reconciledCount} payments.`);
    } catch (e) {
      console.error(`Error processing ${prop.name}: ${e.message}`);
    }
  }

  await prisma.$disconnect();
  await pool.end();
}

main();
