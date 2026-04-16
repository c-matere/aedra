import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

import { PrismaClient } from '@prisma/client';
import { ZuriLeaseConnector } from '../src/sdk/zuri-lease';

async function debugDiscovery() {
    const prisma = new PrismaClient();
    
    // Get a company that has Zuri credentials
    const company = await prisma.company.findFirst({
        where: {
            zuriUsername: { not: null },
            zuriPassword: { not: null }
        }
    });

    if (!company) {
        console.error("No company found with Zuri credentials");
        return;
    }

    console.log(`[DEBUG] Debugging discovery for company: ${company.name}`);
    
    const config = {
        domain: company.zuriDomain || 'sak.zurilease.app',
        credentials: {
            username: company.zuriUsername!,
            password: company.zuriPassword!
        }
    };

    const connector = new ZuriLeaseConnector(config as any);
    
    try {
        console.log("[DEBUG] Connecting...");
        await connector.connect();
        
        const page = (connector as any).page;
        page.on('console', (msg: any) => console.log('BROWSER LOG:', msg.text()));

        console.log("[DEBUG] Waiting 5s for post-login modals...");
        await new Promise(r => setTimeout(r, 5000));
        
        const screenshotPath = path.join(process.cwd(), 'debug_discovery_after_login.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`[DEBUG] Screenshot saved to ${screenshotPath}`);

        console.log("[DEBUG] Navigating to SelectProperty...");
        const selectUrl = (connector as any).getUrl('/SelectProperty');
        console.log(`[DEBUG] URL: ${selectUrl}`);
        
        await page.goto(selectUrl, { waitUntil: 'load', timeout: 30000 });
        
        const listPath = path.join(process.cwd(), 'debug_discovery_select_property.png');
        await page.screenshot({ path: listPath, fullPage: true });
        console.log(`[DEBUG] SelectProperty screenshot saved to ${listPath}`);

        const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a')).map(a => ({
                text: a.textContent?.trim(),
                href: a.getAttribute('href')
            })).filter(l => l.href && (l.href.includes('property') || l.href.includes('id=')));
        });

        console.log("[DEBUG] Identified property links:", JSON.stringify(links, null, 2));

        const propertyIds = await connector.listProperties();
        console.log("[DEBUG] connector.listProperties() results:", propertyIds);

        if (propertyIds.length === 0) {
            const html = await page.content();
            fs.writeFileSync('debug_discovery_page.html', html);
            console.log("[DEBUG] Page HTML dumped to debug_discovery_page.html");
        }

    } catch (error) {
        console.error("[DEBUG] Error encountered:", error);
    } finally {
        await connector.disconnect();
        await prisma.$disconnect();
    }
}

debugDiscovery();
