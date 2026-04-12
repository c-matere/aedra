import { ZuriLeaseConnector } from '../api/src/integrations/zuri-lease/zuri-lease.connector';
import { ConnectorConfig } from '../api/src/integrations/types';

async function testSync() {
  const config: ConnectorConfig = {
    domain: 'sak.zurilease.app',
    credentials: {
      username: 'YOUR_USERNAME',
      password: 'YOUR_PASSWORD',
    },
  };

  const propertyId = '35';
  const connector = new ZuriLeaseConnector(config);

  try {
    console.log(`Connecting to ${config.domain}...`);
    await connector.connect();
    
    console.log(`Fetching data for property ${propertyId}...`);
    const data = await connector.fetchData({ propertyId });
    
    console.log('Sync Results:');
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error during sync:', error);
  } finally {
    await connector.disconnect();
  }
}

testSync();
