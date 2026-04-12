import { ZuriLeaseConnector } from '../api/src/integrations/zuri-lease/zuri-lease.connector';
import { ConnectorConfig } from '../api/src/integrations/types';

async function runBulkImport() {
  const config: ConnectorConfig = {
    domain: 'sak.zurilease.app',
    credentials: {
      username: 'YOUR_USERNAME',
      password: 'YOUR_PASSWORD',
    },
  };

  const propertyCodesToIds: Record<string, string> = {
    '001': '1',
    '0011': '35',
    '0019': '19',
    '0021': '21',
    '0023': '23',
    '0024': '24',
    '0026': '26',
    '0027': '27',
    '0030': '30',
    '0031': '31',
    '0035': '40',
    '0036': '41',
    '0037': '42',
  };

  const propertyIds = Object.values(propertyCodesToIds);
  
  // Note: For actual import into Aedra database, we should use the API endpoint 
  // or a script that has access to Prisma. 
  // Since this script is outside the NestJS context, it will only LOG the data 
  // or we can use curl to the API we just created.

  console.log(`Starting bulk import for ${propertyIds.length} properties...`);
  
  // Recommended: Use the API endpoint for reliable database persistence
  const companyId = 'YOUR_COMPANY_ID'; // The tenant ID in Aedra
  
  console.log('To execute the import, run the following curl command:');
  console.log(`
  curl -X POST http://localhost:3000/integrations/zuri-lease/import-bulk \\
    -H "Content-Type: application/json" \\
    -d '{
      "config": {
        "domain": "${config.domain}",
        "credentials": {
          "username": "YOUR_USERNAME",
          "password": "YOUR_PASSWORD"
        }
      },
      "propertyIds": ${JSON.stringify(propertyIds)},
      "companyId": "${companyId}"
    }'
  `);
}

runBulkImport();
