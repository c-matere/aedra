import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { ZuriLeaseConnector } from '../src/sdk/zuri-lease';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const config = {
    domain: 'sak.zurilease.app',
    credentials: {
      username: 'matere chris',
      password: 'Matere@2025',
    },
  };

  const propertyIds = ["0024", "00331"];
  const companyId = 'e673537b-5249-472f-b209-e09f12b23db4';

  const connector = new ZuriLeaseConnector(config);
  await connector.connect();

  for (const propertyId of propertyIds) {
    try {
      console.log(`\n--- Debugging Property ID: ${propertyId} ---`);
      const data = await connector.fetchData({ propertyId });
      fs.writeFileSync('debug_data.json', JSON.stringify(data, null, 2));
      console.log('Data saved to debug_data.json');
    } catch (error) {
      console.error(`Error:`, error.message);
      fs.writeFileSync('debug_error.txt', error.stack || error.message);
    }
  }

  await connector.disconnect();
  await prisma.$disconnect();
  await pool.end();
}

main();
