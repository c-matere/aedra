import { ZuriLeaseConnector } from '../src/sdk/zuri-lease';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

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
  await (client as any).connect();
  
  try {
    const tenantId = "73";
    console.log(`Performing Sidebar warmup...`);
    await (client as any).warmupReportingSession(tenantId);

    const downloadPath = `/home/chris/aedra/api/scratch_reports`;
    if (!fs.existsSync(downloadPath)) fs.mkdirSync(downloadPath, { recursive: true });

    const page = (client as any).page;
    const browser = (client as any).browser;

    const downloadPage = await browser.newPage();
    const pageClient = await downloadPage.target().createCDPSession();
    await pageClient.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath });

    const now = new Date();
    const formattedDate = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()}`;
    const reportUrl = `https://${config.domain}/DisplayReport?tenant_id=${tenantId}&format=HTML&report=TenantAccountingStatement&start_date=2000-01-01&end_date=${encodeURIComponent(formattedDate)}`;
    
    console.log(`Triggering direct download: ${reportUrl}`);
    try {
        await downloadPage.goto(reportUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    } catch (e: any) {
        console.log(`Navigation result (expected for download): ${e.message}`);
    }

    // Wait for file
    console.log('Waiting for file in', downloadPath);
    let foundFile = '';
    for (let i = 0; i < 15; i++) {
        const files = fs.readdirSync(downloadPath);
        console.log(`Files in dir: ${files.join(', ')}`);
        const reportFile = files.find(f => !f.endsWith('.crdownload'));
        if (reportFile) {
            foundFile = path.join(downloadPath, reportFile);
            break;
        }
        await new Promise(r => setTimeout(r, 1000));
    }

    if (foundFile) {
        console.log(`Found file: ${foundFile}`);
        const content = fs.readFileSync(foundFile, 'utf8');
        console.log('--- RAW CONTENT START (First 1000 chars) ---');
        console.log(content.slice(0, 1000));
        console.log('--- RAW CONTENT END ---');
    } else {
        console.log('No file found after 15 seconds.');
    }

  } catch (error: any) {
    console.error(`Error:`, error.message);
  } finally {
    await client.disconnect();
  }
}

main();
