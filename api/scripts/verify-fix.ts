import { ZuriLeaseConnector } from '../src/sdk/zuri-lease';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const config = {
    domain: 'sak.zurilease.app',
    credentials: {
      username: 'matere chris',
      password: 'Matere@2025',
    },
  };

  const client = new ZuriLeaseConnector(config);
  
  try {
    console.log(`Connecting...`);
    await (client as any).connect();

    const tenantId = "73"; 
    console.log(`Checking existing tabs for tenant ${tenantId}...`);
    const invoicesViaTab = await (client as any).fetchTenantInvoices(tenantId);
    const receiptsViaTab = await (client as any).fetchTenantPayments(tenantId);

    console.log(`\n--- Tab Results for Tenant ${tenantId} ---`);
    console.log(`Invoices via Tab: ${invoicesViaTab.length}`);
    console.log(`Receipts via Tab: ${receiptsViaTab.length}`);

    console.log(`\nPerforming Sidebar warmup...`);
    await (client as any).warmupReportingSession(tenantId);

    console.log(`Fetching combined statement via Browser Download...`);
    const statement = await (client as any).fetchTenantStatement(tenantId);

    console.log(`\n--- Combined Statement Results for Tenant ${tenantId} ---`);
    console.log(`Invoices: ${statement.invoices.length}`);
    console.log(`Receipts: ${statement.receipts.length}`);

  } catch (error: any) {
    console.error(`Error:`, error.message);
  } finally {
    await client.disconnect();
  }
}

main();
