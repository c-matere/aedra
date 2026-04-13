import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { ConnectorConfig, IConnector } from '../types';
import { ZuriLeaseData, ZuriLeaseProperty, ZuriLeaseUnit, ZuriLeaseTenant, ZuriLeasePayment, ZuriLeaseLease, ZuriLeaseReceipt, ZuriLeaseInvoice } from './types';

export class ZuriLeaseConnector implements IConnector {
  public name = 'Zuri Lease';
  private browser: Browser | null = null;
  private page: Page | null = null;
  private config: ConnectorConfig;

  constructor(config: ConnectorConfig) {
    this.config = config;
  }

  private getUrl(path: string): string {
    const base = this.config.baseUrl || `https://${this.config.domain}`;
    const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${normalizedBase}${normalizedPath}`;
  }

  async connect(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH || puppeteer.executablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-quic', '--window-size=1920,1080'],
      protocolTimeout: 120000,
    });
    this.page = await this.browser.newPage();

    // Stealth overrides
    await this.page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
    });
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      (window as any).chrome = { runtime: {} };
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-GB', 'en-US', 'en'] });
    });

    this.page.on('console', msg => {
      const text = msg.text();
      // Suppress noisy authorization errors for modules the user doesn't have access to
      if (text.includes('not authorised to view billing information')) return;
      console.log('PAGE LOG:', text);
    });
    await this.page.setViewport({ width: 1280, height: 800 });

    const loginUrl = this.getUrl('/login.jsp');
    await this.page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 90000 });

    if (this.config.credentials?.username && this.config.credentials?.password) {
      await this.page.evaluate(`(function(user, pass) {
        var u = document.querySelector('#username');
        var p = document.querySelector('input[name="my_password"]');
        if (u) u.value = user;
        if (p) p.value = pass;
        var btn = document.querySelector('button[type="submit"], input[type="submit"]');
        if (btn) btn.click();
      })('${this.config.credentials.username}', '${this.config.credentials.password}')`);

      try {
        await this.page.waitForSelector('#mainTabContent', { timeout: 60000 });
        await this.dismissModals();
      } catch (e) {
        if (this.page) await this.page.screenshot({ path: `/home/chris/aedra/api/login_failed.png` });
        throw e;
      }
    }
  }

  async listProperties(): Promise<string[]> {
    if (!this.page) throw new Error('Connector not connected');
    
    const ids = new Set<string>();

    // STRATEGY 1: Check current URL (might already be on a property dashboard)
    const currentUrl = this.page.url();
    if (currentUrl.includes('property_id=')) {
        const urlObj = new URL(currentUrl);
        const pid = urlObj.searchParams.get('property_id');
        if (pid) {
            console.log(`[Discovery] Found property ID in current URL: ${pid}`);
            ids.add(pid);
        }
    }

    // STRATEGY 2: Scrape the current page for ANY property links (Sidebar, Top nav, breadcrumbs)
    const scanPage = async () => {
        const found = await this.page!.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a, option, .nav-link'));
            const discovered = new Set<string>();
            links.forEach(el => {
                const href = el.getAttribute('href') || (el as any).value || '';
                if (href && href.includes('property_id=')) {
                    try {
                        const url = new URL(href, window.location.origin);
                        const id = url.searchParams.get('property_id');
                        if (id) discovered.add(id);
                    } catch (e) {}
                }
            });
            return Array.from(discovered);
        });
        found.forEach(id => ids.add(id));
    };

    console.log('[Discovery] Scanning dashboard for property links...');
    await scanPage();

    // STRATEGY 3: Attempt navigation to SelectProperty only if we have few/no results
    if (ids.size === 0) {
        console.log('[Discovery] No properties found on dashboard. Navigating to /SelectProperty...');
        await this.page.goto(this.getUrl('/SelectProperty'), {
            waitUntil: 'networkidle2',
            timeout: 30000,
        }).catch(e => console.warn(`[Discovery] SelectProperty navigation failed: ${e.message}`));
        
        await scanPage();
    }

    // STRATEGY 4: Check if we are in a "managed" view where the property ID is in a specific breadcrumb
    if (ids.size === 0) {
        const breadcrumbId = await this.page.evaluate(() => {
            const breadcrumbs = Array.from(document.querySelectorAll('.breadcrumb-item, .breadcrumb a'));
            for (const b of breadcrumbs) {
                const href = b.getAttribute('href');
                if (href && href.includes('property_id=')) {
                    try {
                        const id = new URL(href, window.location.origin).searchParams.get('property_id');
                        if (id) return id;
                    } catch (e) {}
                }
            }
            return null;
        });
        if (breadcrumbId) ids.add(breadcrumbId);
    }

    // STRATEGY 5: Explicit Search (Zuri Dashboard Search)
    if (ids.size === 0) {
        console.log('[Discovery] Trying strategy 5: Explicit Search via portfolio_dashboard.jsp...');
        try {
            await this.page.goto(this.getUrl('/portfolio_dashboard.jsp'), { waitUntil: 'networkidle2', timeout: 30000 });
            
            const hasSearch = await this.page.evaluate(() => !!document.querySelector('#propertySearchInput'));
            if (hasSearch) {
                console.log('[Discovery] Submitting empty property search...');
                await this.page.type('#propertySearchInput', '');
                await Promise.all([
                    this.page.click('#propertySearchForm button[type="submit"]'),
                    this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {})
                ]);
                await scanPage();
            } else {
                console.log('[Discovery] Property search input not found on portfolio dashboard.');
            }
        } catch (e) {
            console.warn(`[Discovery] Strategy 5 failed: ${e.message}`);
        }
    }

    // STRATEGY 6: Landlord List (Backup)
    if (ids.size === 0) {
        console.log('[Discovery] Trying strategy 6: Landlord list...');
        try {
            await this.page.goto(this.getUrl('/LoadListOfLandlords'), { waitUntil: 'networkidle2', timeout: 30000 });
            await scanPage();
        } catch (e) {
            console.warn(`[Discovery] Strategy 6 failed: ${e.message}`);
        }
    }

    const finalIds = Array.from(ids).sort();
    console.log(`[Discovery] Final discovery results: ${finalIds.join(', ')} (${finalIds.length} found)`);
    return finalIds;
  }

  async fetchData(params: { propertyId: string }): Promise<ZuriLeaseData> {
    if (!this.page) throw new Error('Connector not connected');

    const property = await this.fetchPropertyDetails(params.propertyId);
    if (!property.code && !property.alias) {
        console.warn(`Property ${params.propertyId} seems inaccessible or empty. Skipping unit/payment scrape.`);
        return { property, units: [], tenants: [], payments: [] };
    }

    const units = await this.fetchUnits(params.propertyId);
    
    let payments: ZuriLeasePayment[] = [];
    try {
        payments = await this.fetchRemittances(params.propertyId);
    } catch (e) {
        console.warn(`Could not fetch remittances for property ${params.propertyId}: ${e.message}`);
    }
    
    // Expand units with lease data serially to avoid timeouts / rate-limiting
    const concurrencyLimit = 1;
    const unitsToProcess = units.filter(u => u.occupancyTenantName);
    
    for (let i = 0; i < unitsToProcess.length; i += concurrencyLimit) {
        const chunk = unitsToProcess.slice(i, i + concurrencyLimit);
        await Promise.all(chunk.map(async (unit) => {
            unit.leases = await this.fetchUnitLeases(params.propertyId, unit.unitId);
        }));
    }

    // NEW: Use Sidebar to ensure session is refreshed and bypass 405/403
    await this.navigateToTenants();

    const tenantIdsSet = new Set<string>();
    for (const unit of units) {
        if (unit.occupancyTenantId) tenantIdsSet.add(unit.occupancyTenantId);
        if (unit.leases) {
            for (const lease of unit.leases) {
                if (lease.tenantId) tenantIdsSet.add(lease.tenantId);
            }
        }
    }

    const tenants: ZuriLeaseTenant[] = [];
    const tenantIds = Array.from(tenantIdsSet);
    
    // WARMUP: Access the first tenant's statement to "unlock" the reporting system session
    if (tenantIds.length > 0) {
        try {
            console.log(`Performing reporting session warmup with tenant ${tenantIds[0]}...`);
            await this.warmupReportingSession(tenantIds[0]);
        } catch (e) {
            console.warn(`Reporting warmup failed: ${e.message}`);
        }
    }

    // Process tenants serially to avoid overwhelming Zuri
    for (const tid of tenantIds) {
        try {
            console.log(`Processing deep history for tenant ${tid}...`);
            const details = await this.fetchTenantDetails(tid);
            // Fetch statement (Ledger) which contains both invoices and receipts
            let statement: { receipts: ZuriLeaseReceipt[]; invoices: ZuriLeaseInvoice[] } = { receipts: [], invoices: [] };
            try {
                statement = await this.fetchTenantStatement(tid);
            } catch (e) {
                console.warn(`Could not fetch statement for tenant ${tid}: ${e.message}`);
            }
            
            if (details) {
                tenants.push({ 
                    ...details, 
                    receipts: statement.receipts, 
                    invoices: statement.invoices 
                } as ZuriLeaseTenant);
            }
        } catch (e) {
            console.error(`Error processing tenant ${tid}:`, e.message);
        }
    }

    return { property, units, tenants, payments };
  }

  private async warmupReportingSession(tenantId: string): Promise<void> {
    if (!this.page) return;
    
    console.log('--- Establishing reporting session via official Sidebar path ---');
    await this.page.goto(this.getUrl('/index.jsp'), { waitUntil: 'networkidle2' });
    
    // 1. Click "TENANTS" in the sidebar specifically
    await this.page.evaluate(() => {
        // Find the TENANTS link in the sidebar
        const sidebarLinks = Array.from(document.querySelectorAll('a, .nav-link'));
        const tenantsTab = sidebarLinks.find(l => (l.textContent || '').trim().toUpperCase() === 'TENANTS');
        if (tenantsTab) (tenantsTab as any).click();
    });

    await new Promise(r => setTimeout(r, 2000));

    // 2. Locate and click "Billing" - in some views it's a card, in others it's a sub-sidebar item
    const billingFound = await this.page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a, p, span, button'));
        const billingLink = links.find(el => (el.textContent || '').trim() === 'Billing');
        if (billingLink) {
            (billingLink as any).click();
            return true;
        }
        return false;
    });

    if (billingFound) {
        console.log('Navigated via official Billing path.');
        await new Promise(r => setTimeout(r, 3000));
    }

    // 3. Establish the session cookies for sak.zurilease.app
    const now = new Date();
    const formattedDate = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()}`;
    // Use wide date range for "All Time" history
    const reportUrl = this.getUrl(`/DisplayReport?tenant_id=${tenantId}&format=HTML&report=TenantAccountingStatement&start_date=2000-01-01&end_date=${encodeURIComponent(formattedDate)}`);
    
    try {
      await this.page.goto(reportUrl, { 
          waitUntil: 'domcontentloaded', 
          timeout: 60000,
          referer: this.getUrl('/index.jsp')
      });
        console.log('Reporting session warmed up successfully.');
    } catch (e: any) {
        const msg = e.message;
        if (!msg.includes('ERR_ABORTED') && !msg.includes('timeout')) {
            console.warn(`Warmup navigation warning: ${msg}`);
        }
    }
  }

  private async fetchTenantStatement(tenantId: string): Promise<{ receipts: ZuriLeaseReceipt[], invoices: ZuriLeaseInvoice[] }> {
    if (!this.page || !this.browser) return { receipts: [], invoices: [] };

    const downloadPath = `/home/chris/.gemini/antigravity/brain/${process.env.CONVERSATION_ID}/scratch`;
    if (!fs.existsSync(downloadPath)) fs.mkdirSync(downloadPath, { recursive: true });

    try {
        const client = await (this.page as any).target().createCDPSession();
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: downloadPath,
        });

        const now = new Date();
        const formattedDate = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()}`;
        const reportUrl = this.getUrl(`/DisplayReport?tenant_id=${tenantId}&format=HTML&report=TenantAccountingStatement&start_date=2000-01-01&end_date=${encodeURIComponent(formattedDate)}`);
        
        console.log(`Triggering report download for tenant ${tenantId}...`);
        
        // Use a new page for the download to avoid disrupting the main page context
        const downloadPage = await this.browser.newPage();
        const pageClient = await downloadPage.target().createCDPSession();
        await pageClient.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath });

        try {
            await downloadPage.goto(reportUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        } catch (e: any) {
            if (!e.message.includes('ERR_ABORTED')) throw e;
        }

        // Wait for file to appear (TenantAccountStatement.csv or similar)
        let filePath = '';
        for (let i = 0; i < 15; i++) {
            const files = fs.readdirSync(downloadPath);
            const reportFile = files.find(f => f.includes('TenantAccountingStatement') && !f.endsWith('.crdownload'));
            if (reportFile) {
                filePath = path.join(downloadPath, reportFile);
                break;
            }
            await new Promise(r => setTimeout(r, 1000));
        }

        if (!filePath) {
            console.warn(`Report download timed out for tenant ${tenantId}`);
            await downloadPage.close();
            return { receipts: [], invoices: [] };
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        fs.unlinkSync(filePath); // Cleanup
        await downloadPage.close();

        if (!content || content.length < 10) return { receipts: [], invoices: [] };

        // Parsing logic for CSV/Text content
        const rows: string[][] = content.split('\n').map(line => {
            const cols = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) {
                    cols.push(current.trim());
                    current = '';
                } else current += char;
            }
            cols.push(current.trim());
            return cols;
        });

            if (rows.length === 0) return { receipts: [], invoices: [] };
            
            const receipts: any[] = [];
            const invoices: any[] = [];
            
            rows.forEach(function(cols) {
                // Heuristic: A data row must have a date and a transaction code
                if (cols.length < 5) return;
                
                // 1. Find Date (looking for dd-MMM-yyyy or similar)
                // Note: Zuri uses 01-Sep-2024
                const dateIdx = cols.findIndex(c => /^\d{1,2}-[A-Za-z]{3,9}-\d{4}$/.test(c.trim()));
                if (dateIdx === -1) return;
                const date = cols[dateIdx].trim();

                // 2. Find Transaction Code (INV, RCT, BILL, SI, etc.)
                // Usually comes after the date
                const codeIdx = cols.findIndex((c, i) => i > dateIdx && /INV|RCT|BILL|PAY|SI\d+|SJ\d+|RCT/.test(c.toUpperCase()));
                if (codeIdx === -1) return;
                const code = cols[codeIdx].trim();

                // 3. Description is usually the next non-empty cell after code
                const descIdx = cols.findIndex((c, i) => i > codeIdx && c.trim().length > 1);
                const desc = descIdx !== -1 ? cols[descIdx].trim() : '';

                // 4. Find amounts (numeric values) following description
                // We clean currency symbols and commas. Zuri uses "28,000.00" or "(28,000.00)"
                const values = cols.map((c, i) => ({ val: c.trim(), idx: i }))
                    .filter(o => o.idx > codeIdx && /^\(?[\d,.]+\)?$/.test(o.val) && o.val.match(/\d/))
                    .map(o => ({ 
                        amount: parseFloat(o.val.replace(/[(),]/g, '')) || 0,
                        idx: o.idx,
                        raw: o.val
                    }))
                    .filter(v => v.amount !== 0);

                if (values.length === 0) return;

                // The first non-zero numeric value after description is typically the amount.
                // The very last value in the row is often the running balance, which we ignore.
                const amount = values[0].amount;
                
                if (code.toUpperCase().includes('INV') || code.toUpperCase().includes('BILL')) {
                    invoices.push({
                        code: code,
                        date: date,
                        dueDate: date,
                        amount: amount,
                        description: desc,
                        status: 'PAID'
                    });
                } else if (code.toUpperCase().includes('RCT') || code.toUpperCase().includes('PAY')) {
                    receipts.push({
                        code: code,
                        date: date,
                        amount: amount,
                        description: desc,
                        status: 'CLEARED'
                    });
                }
            });
            return { receipts: receipts, invoices: invoices };
    } catch (e: any) {
        console.error(`Error fetching tenant statement for ${tenantId}:`, e.message);
        return { receipts: [], invoices: [] };
    }
  }

  private async navigateToTenants(): Promise<void> {
    if (!this.page) return;
    await this.page.goto(this.getUrl('/index.jsp'), { waitUntil: 'networkidle2' });
    await this.page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a, button, li, .nav-link'));
        const link = links.find(l => l.textContent?.trim().toUpperCase() === 'TENANTS');
        if (link) (link as any).click();
    });
    await this.page.waitForSelector('table', { timeout: 10000 }).catch(() => {});
  }

  private async fetchPropertyDetails(propertyId: string): Promise<ZuriLeaseProperty> {
    if (!this.page) throw new Error('Connector not connected');
    
    await this.page.goto(this.getUrl(`/SelectProperty?property_id=${propertyId}`), {
      waitUntil: 'networkidle0',
      timeout: 90000,
    });

    const isAccessError = await this.page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return text.includes('access error') || 
               text.includes('not authorized') || 
               text.includes('no search results') ||
               text.includes("oops! something's not right");
    });

    if (isAccessError) {
        return { 
            id: propertyId, 
            code: '', 
            alias: '', 
            location: { country: '', region: '', town: '', area: '' }, 
            contract: { manager: '', status: '', startDate: '', endDate: '' }, 
            landlord: { id: '', name: '' } 
        } as ZuriLeaseProperty;
    }

    const details = await this.page.evaluate(`(function() {
      var getVal = function(label) {
        var rows = Array.from(document.querySelectorAll('tr'));
        var labelLower = label.toLowerCase();
        var row = rows.find(function(r) {
          var first = r.querySelector('td:first-child, th:first-child');
          return first && first.textContent && first.textContent.trim().toLowerCase().startsWith(labelLower);
        });
        return row ? (row.querySelector('td:last-child') ? row.querySelector('td:last-child').textContent.trim() : '') : '';
      };

      return {
        code: getVal('Code'),
        alias: getVal('Alias'),
        plotNo: getVal('Plot No'),
        class: getVal('Class'),
        type: getVal('Class'), // Zuri 'Type' label matches nav tabs; value lives under 'Class'
        category: getVal('Category'),
        location: {
          country: getVal('Country'),
          region: getVal('Region'),
          town: getVal('Town'),
          area: getVal('Area'),
        },
        contract: {
          manager: getVal('Manager'),
          status: getVal('Status'),
          startDate: getVal('Start Date'),
          endDate: getVal('End Date'),
        },
        landlord: {
            id: getVal('L/L No'),
            name: getVal('Name'),
        }
      };
    })()`) as any;

    return { id: propertyId, ...details } as ZuriLeaseProperty;
  }

  private async dismissModals(): Promise<void> {
    if (!this.page) return;
    try {
        await this.page.evaluate(`(function() {
            var buttons = Array.from(document.querySelectorAll('button, a'));
            var laterBtn = buttons.find(function(b) { 
                var t = (b.textContent || '').trim();
                return t.includes('Later') || t.includes('Close') || t === '×'; 
            });
            if (laterBtn) laterBtn.click();
        })()`);
        await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
        // Ignore modal errors
    }
  }

  private async fetchRemittances(propertyId: string): Promise<ZuriLeasePayment[]> {
    if (!this.page) throw new Error('Connector not connected');
    
    await this.dismissModals();

    // Navigation to Remittances tab
    await this.page.evaluate(`(function() {
        const tabs = Array.from(document.querySelectorAll('a, button, li'));
        const remTab = tabs.find(function(t) { 
          const text = (t.textContent || '').trim();
          return text === 'Remittances' || text.includes('Remittances'); 
        });
        if (remTab) remTab.click();
    })()`);
    await new Promise(r => setTimeout(r, 2000));
    await this.page.waitForSelector('#remittances, table', { timeout: 8000 }).catch(() => {});

    const payments = await this.page.evaluate(`(function() {
      const table = document.querySelector('#remittances');
      if (!table) return [];
      const rows = Array.from(table.querySelectorAll('tr')).slice(1);
      return rows.map(function(row) {
        const cols = row.querySelectorAll('td');
        if (cols.length < 7) return null;
        return {
          code: cols[0] ? cols[0].textContent.trim() : '',
          date: cols[1] ? cols[1].textContent.trim() : '',
          description: cols[2] ? cols[2].textContent.trim() : '',
          status: cols[3] ? cols[3].textContent.trim() : '',
          grossAmount: parseFloat((cols[4] ? cols[4].textContent : '0').replace(/,/g, '') || '0'),
          deductions: parseFloat((cols[5] ? cols[5].textContent : '0').replace(/,/g, '') || '0'),
          netAmount: parseFloat((cols[6] ? cols[6].textContent : '0').replace(/,/g, '') || '0'),
        };
      }).filter(function(p) { return p !== null; });
    })()`) as ZuriLeasePayment[];

    return payments;
  }

  private async fetchUnitLeases(propertyId: string, unitId: string): Promise<ZuriLeaseLease[]> {
    if (!this.page || !this.browser) return [];

    let unitPage: Page | null = null;
    try {
        unitPage = await this.browser.newPage();
        await unitPage.setViewport({ width: 1280, height: 800 });
        
        await unitPage.goto(this.getUrl(`/SelectUnit?unit_id=${unitId}`), {
            waitUntil: 'domcontentloaded',
            timeout: 90000,
        });

        // Occupancy tab is default, but let's ensure it's there
        await unitPage.waitForSelector('#tenant', { timeout: 5000 }).catch(() => {});

        const leases = await unitPage.evaluate(`(function() {
            var table = document.querySelector('#tenant');
            if (!table) return [];
            var rows = Array.from(table.querySelectorAll('tr')).slice(1);
            return rows.map(function(row) {
                var cols = row.querySelectorAll('td');
                if (cols.length < 3) return null;

                // Safely grab tenant link from anywhere in the row since columns vary
                var allLinks = Array.from(row.querySelectorAll('a'));
                var tenantLink = allLinks.find(function(a) { return a.href && a.href.includes('tenant_id'); });
                var tenantId = tenantLink ? new URL(tenantLink.href, window.location.origin).searchParams.get('tenant_id') : '';

                return {
                    tenantId: tenantId || '',
                    tenantName: cols[1] ? cols[1].textContent.trim() : '',
                    unitCode: cols[0] ? cols[0].textContent.trim() : '',
                    startDate: cols[2] ? cols[2].textContent.trim() : '',
                    endDate: cols[3] ? cols[3].textContent.trim() : '',
                    status: cols[4] ? cols[4].textContent.trim() : '',
                };
            }).filter(function(l) { return l !== null; });
        })()`) as ZuriLeaseLease[];

        return leases;
    } catch (e) {
        console.error(`Error fetching unit leases for unit ${unitId}:`, e.message);
        return [];
    } finally {
        if (unitPage) await unitPage.close();
    }
  }

  private async fetchUnits(propertyId: string): Promise<ZuriLeaseUnit[]> {
    if (!this.page) throw new Error('Connector not connected');
    
    await this.dismissModals();

    await this.page.evaluate(`(function() {
        console.log('Searching for Units tab...');
        const unitTab = document.querySelector('a#tab-listing-tab') || 
                        Array.from(document.querySelectorAll('a, button, li, .nav-link')).find(function(t) { 
                          const text = (t.textContent || '').trim().toUpperCase();
                          return text === 'UNITS' || text.includes('UNITS') || text === 'LISTING'; 
                        });
        if (unitTab) {
          console.log('Units tab found, clicking...');
          unitTab.click();
        }
    })()`);

    // Wait for the Tab Pane to become active or the table to exist
    await this.page.waitForSelector('#units, #tab-all-units, #tab-listing', { timeout: 8000 }).catch(() => {
        console.warn('Units tab pane did not become active via selector. Proceeding with caution.');
    });

    // Progressively wait for the table to appear and have actual data rows 
    // (DataTable often starts with a single-column loading row)
    try {
        await this.page.waitForFunction(() => {
            const tables = Array.from(document.querySelectorAll('table'));
            const table = tables.find(t => {
                const head = t.querySelector('thead');
                const text = (head ? head.textContent : t.textContent) || '';
                return text.includes('Code') && (text.includes('Unit Type') || text.includes('Occupancy'));
            });
            if (!table) return false;
            const dataRows = Array.from(table.querySelectorAll('tbody tr'));
            return dataRows.length > 0 && dataRows[0].querySelectorAll('td').length > 1;
        }, { timeout: 15000 });
    } catch (e) {
        console.warn('Timed out waiting for units table tbody. Proceeding.');
    }

    const units = await this.page.evaluate(`(function() {
      console.log('Searching for correct units table...');
      var tables = Array.from(document.querySelectorAll('table'));
      
      // Try to find by specific headers first (case-insensitive)
      var table = tables.find(function(t) {
          var headerText = (t.querySelector('thead') ? t.querySelector('thead').textContent : t.textContent || '').toUpperCase();
          return (headerText.includes('CODE') && (headerText.includes('UNIT TYPE') || headerText.includes('RENT & S.C') || headerText.includes('MARKET RENT')));
      });

      // Special case: Zuri often uses #units for the main unit table
      if (!table) table = document.getElementById('units');

      // Fallback: look specifically inside the 'units' tab pane if it's active
      if (!table) {
          table = document.querySelector('#units.active table, .tab-pane.active#units table, div[role="tabpanel"].active table, #tab-all-units table');
          if (table) console.log('Found table inside active units pane');
      }

      if (!table) {
        console.error('No units table found with expected headers or selectors!');
        return [];
      }
      console.log('Units table found, parsing rows...');
      var rows = Array.from(table.querySelectorAll('tbody tr, tr')).filter(function(r) {
          // Exclude header rows if they are inside tbody or if we got them via outer tr selector
          return !r.querySelector('th');
      });
      console.log('Found ' + rows.length + ' rows in units table.');
      return rows.map(function(row) {
        var cols = row.querySelectorAll('td');
        if (cols.length < 3) {
          console.log('Row skipped: ' + cols.length + ' columns. Content: ' + row.textContent.trim());
          return null;
        }

        // Column layout (actual Zuri HTML):
        // 0: Code (link)  1: Unit Type  2: Rent & S.C  3: Payable  4: Occupancy  5: Tenant Balance
        var unitLink = cols[0] ? cols[0].querySelector('a') : null;
        var unitId = '';
        if (unitLink && unitLink.href) {
            var url = new URL(unitLink.href, window.location.origin);
            unitId = url.searchParams.get('unit_id') || '';
        }

        // Tenant name and link live in the Occupancy column (col 4)
        var occupancyCol = cols[4] || cols[3]; // fallback to col 3 for older Zuri layouts
        var tenantLink = occupancyCol ? occupancyCol.querySelector('a') : null;
        var tenantId = '';
        if (tenantLink && tenantLink.href) {
            var url = new URL(tenantLink.href, window.location.origin);
            tenantId = url.searchParams.get('tenant_id') || '';
        }
        var occupancyText = occupancyCol ? occupancyCol.textContent.trim() : '';
        // 'Vacant, Available' or 'Vacant, Notice' means unoccupied
        var isVacant = occupancyText.toLowerCase().startsWith('vacant');

        return {
          unitId: unitId,
          unitCode: cols[0] ? cols[0].textContent.trim() : '',
          unitType: cols[1] ? cols[1].textContent.trim() : '',
          rent: parseFloat((cols[2] ? cols[2].textContent : '0').replace(/,/g, '') || '0'),
          occupancyTenantName: isVacant ? '' : occupancyText,
          occupancyTenantId: isVacant ? '' : tenantId,
          balance: parseFloat((cols[5] ? cols[5].textContent : (cols[4] ? cols[4].textContent : '0')).replace(/,/g, '') || '0'),
        };
      }).filter(function(u) { return u !== null; });
    })()`) as ZuriLeaseUnit[];

    return units;
  }

  private async fetchTenantDetails(tenantId: string): Promise<Partial<ZuriLeaseTenant> | null> {
    if (!this.page || !this.browser) return null;

    let tenantPage: Page | null = null;
    try {
        tenantPage = await this.browser.newPage();
        await tenantPage.setViewport({ width: 1280, height: 800 });
        
        await tenantPage.goto(this.getUrl(`/SelectTenant?tenant_id=${tenantId}`), {
            waitUntil: 'domcontentloaded',
            timeout: 90000,
        });

        const details = await tenantPage.evaluate(`(function() {
            function getVal(label) {
                var rows = Array.from(document.querySelectorAll('tr'));
                var labelLower = label.toLowerCase();
                var row = rows.find(function(r) {
                    var first = r.querySelector('td:first-child, th:first-child');
                    return first && first.textContent && first.textContent.trim().toLowerCase().startsWith(labelLower);
                });
                if (row) {
                    var last = row.querySelector('td:last-child');
                    return last ? last.textContent.trim() : '';
                }
                var els = Array.from(document.querySelectorAll('td, th, b, strong, span'));
                var el = els.find(function(e) {
                    return e.textContent && e.textContent.trim().toLowerCase() === labelLower;
                });
                if (el) {
                    if (el.nextElementSibling) return el.nextElementSibling.textContent.trim();
                    var tr = el.closest('tr');
                    if (tr) {
                        var last = tr.querySelector('td:last-child');
                        return last ? last.textContent.trim() : '';
                    }
                }
                return '';
            }

            function getValNextRow(label) {
                var rows = Array.from(document.querySelectorAll('tr'));
                var labelLower = label.toLowerCase();
                var idx = rows.findIndex(function(r) {
                    var first = r.querySelector('td:first-child, th:first-child');
                    return first && first.textContent && first.textContent.trim().toLowerCase().startsWith(labelLower);
                });
                if (idx >= 0 && idx < rows.length - 1) {
                    var nextRow = rows[idx + 1];
                    var cell = nextRow.querySelector('td, th');
                    if (cell) return cell.textContent.trim();
                }
                return '';
            }

            // Phone: try exhaustive label variants. In Zuri, it often lands in the row immediately following the label.
            var phone = getValNextRow('Primary Tel') ||
                        getValNextRow('Primary Tel.') ||
                        getValNextRow('Tel') ||
                        getValNextRow('Phone') ||
                        getValNextRow('Mobile') ||
                        getValNextRow('Contact') ||
                        getValNextRow('GSM') ||
                        getValNextRow('Cell') ||
                        getVal('Primary Tel') ||
                        getVal('Primary Tel.') ||
                        getVal('Tel') ||
                        getVal('Phone') ||
                        getVal('Mobile') ||
                        getVal('Contact') ||
                        getVal('GSM') ||
                        getVal('Cell');

            var unitVal = getVal('Unit');
            var unitParts = unitVal ? unitVal.split(':').map(function(s) { return s.trim(); }) : [];

            return {
                name: getVal('Name') || getVal('Company'),
                idNo: getVal('ID No.') || getVal('ID No') || getVal('ID Number'),
                phone: phone,
                rent: parseFloat((getVal('Rent') || '0').replace(/,/g, '') || '0'),
                depositHeld: parseFloat((getVal('Deposit Held') || '0').replace(/,/g, '') || '0'),
                leaseStartDate: getVal('Start') || getVal('Start Date'),
                leaseEndDate: getVal('End') || getVal('End Date'),
                autoRenew: (getVal('Auto Renew') || '').toLowerCase() === 'true',
                paymentFrequency: getVal('Mode') || getVal('Frequency'),
                unitCode: unitParts[0] || '',
                unitName: unitParts[1] || '',
            };
        })()`) as any;

        return { id: tenantId, ...details };
    } catch (e) {
        console.error(`Error fetching tenant details for ${tenantId}:`, e.message);
        return null;
    } finally {
        if (tenantPage) await tenantPage.close();
    }
  }

  private async fetchTenantPayments(tenantId: string): Promise<ZuriLeaseReceipt[]> {
    if (!this.page || !this.browser) return [];

    let tenantPage: Page | null = null;
    try {
        tenantPage = await this.browser.newPage();
        await tenantPage.setViewport({ width: 1280, height: 800 });
        
        await tenantPage.goto(this.getUrl(`/SelectTenant?tenant_id=${tenantId}`), {
            waitUntil: 'domcontentloaded',
            timeout: 90000,
        });

        // Click Receipts tab
        await tenantPage.evaluate(`(function() {
            const tabs = Array.from(document.querySelectorAll('a, button'));
            const rectTab = tabs.find(function(t) { 
                const text = (t.textContent || '').trim().toUpperCase();
                return text === 'RECEIPTS' || text.includes('RECEIPTS'); 
            });
            if (rectTab) rectTab.click();
        })()`);
        await tenantPage.waitForSelector('#receipts, table', { timeout: 8000 }).catch(() => {});

        const receipts = await tenantPage.evaluate(`(function() {
            const table = document.querySelector('#receipts') || 
                          Array.from(document.querySelectorAll('table')).find(t => t.textContent.includes('RCT'));
            if (!table) return [];
            const rows = Array.from(table.querySelectorAll('tr')).slice(1);
            return rows.map(function(row) {
                const cols = row.querySelectorAll('td');
                if (cols.length < 3) return null;
                // Receipts Table: 0: RCT No  1: Date  2: Amount  3: Description  4: Status
                return {
                    code: cols[0] ? cols[0].textContent.trim() : '',
                    date: cols[1] ? cols[1].textContent.trim() : '',
                    amount: parseFloat((cols[2] ? cols[2].textContent : '0').replace(/,/g, '') || '0'),
                    description: cols[3] ? cols[3].textContent.trim() : '',
                    status: cols[4] ? cols[4].textContent.trim() : 'CLEARED',
                };
            }).filter(function(r) { return r !== null; });
        })()`) as ZuriLeaseReceipt[];

        return receipts;
    } catch (e) {
        console.error(`Error fetching tenant payments for ${tenantId}:`, e.message);
        return [];
    } finally {
        if (tenantPage) await tenantPage.close();
    }
  }

  private async fetchTenantInvoices(tenantId: string): Promise<ZuriLeaseInvoice[]> {
    if (!this.page || !this.browser) return [];

    let tenantPage: Page | null = null;
    try {
        tenantPage = await this.browser.newPage();
        await tenantPage.setViewport({ width: 1280, height: 800 });
        
        await tenantPage.goto(this.getUrl(`/SelectTenant?tenant_id=${tenantId}`), {
            waitUntil: 'domcontentloaded',
            timeout: 90000,
        });

        // Click Bills/Invoices tab
        await tenantPage.evaluate(`(function() {
            const tabs = Array.from(document.querySelectorAll('a, button'));
            const invTab = tabs.find(function(t) { 
              const text = (t.textContent || '').trim().toUpperCase();
              return text === 'INVOICES' || text === 'BILLS' || text.includes('INVOICES'); 
            });
            if (invTab) invTab.click();
        })()`);
        
        // Zuri often uses #invoices or #bills for history
        await tenantPage.waitForSelector('#invoices, #bills, #billHistory, table', { timeout: 8000 }).catch(() => {});

        const invoices = await tenantPage.evaluate(`(function() {
            const table = document.querySelector('#invoices, #bills, #billHistory') || 
                          Array.from(document.querySelectorAll('table')).find(t => t.textContent.includes('INV'));
            if (!table) return [];
            const rows = Array.from(table.querySelectorAll('tr')).slice(1);
            return rows.map(function(row) {
                const cols = row.querySelectorAll('td');
                if (cols.length < 5) return null;
                // Layout from screenshot: 
                // 0: INV#  1: DUE DATE  2: TYPE  3: DESCRIPTION  4: AMOUNT  5: BALANCE
                return {
                    code: cols[0] ? cols[0].textContent.trim() : '',
                    date: cols[1] ? cols[1].textContent.trim() : '',
                    dueDate: cols[1] ? cols[1].textContent.trim() : '',
                    description: cols[3] ? cols[3].textContent.trim() : '',
                    amount: parseFloat((cols[4] ? cols[4].textContent : '0').replace(/,/g, '') || '0'),
                    status: 'PAID', // Inferred from layout if not explicit
                };
            }).filter(function(i) { return i !== null; });
        })()`) as ZuriLeaseInvoice[];

        return invoices;
    } catch (e) {
        console.error(`Error fetching tenant invoices for ${tenantId}:`, e.message);
        return [];
    } finally {
        if (tenantPage) await tenantPage.close();
    }
  }

  async disconnect(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}
