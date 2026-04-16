import { ZuriLeaseConnector } from '../src/sdk/zuri-lease';

async function debug() {
  const config = {
    domain: 'sak.zurilease.app',
    credentials: {
      username: 'matere chris',
      password: 'Matere@2025',
    },
  };

  const connector = new ZuriLeaseConnector(config);
  await connector.connect();

  const propertyId = '31'; // A property with 10 units but 0 tenants
  console.log(`\n--- Debugging Property ID: ${propertyId} ---`);
  
  const units = await (connector as any).fetchUnits(propertyId);
  console.log(`Found ${units.length} units.`);
  
  for (const unit of units) {
    console.log(`Unit: ${unit.unitCode}, Occupied: ${!!unit.occupancyTenantName}, TenantID: ${unit.occupancyTenantId}`);
  }

  await connector.disconnect();
}

debug();
