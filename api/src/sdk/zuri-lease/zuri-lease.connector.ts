import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { ConnectorConfig, IConnector } from './base.types';
import {
  ZuriLeaseData,
  ZuriLeaseProperty,
  ZuriLeaseUnit,
  ZuriLeaseTenant,
  ZuriLeasePayment,
  ZuriLeaseLease,
  ZuriLeaseReceipt,
  ZuriLeaseInvoice,
} from './types';

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

  private getWorkDirPath(): string {
    return this.config.workDir || process.cwd();
  }

  async connect(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: true,
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH ||
        process.env.CHROME_PATH ||
        puppeteer.executablePath(),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-quic',
        '--window-size=1920,1080',
      ],
      protocolTimeout: 120000,
    });
    this.page = await this.browser.newPage();

    // Stealth overrides
    await this.page.setUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    );
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
    });
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      (window as any).chrome = { runtime: {} };
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-GB', 'en-US', 'en'],
      });
    });

    this.page.on('console', (msg) => {
      const text = msg.text();
      // Suppress noisy authorization errors for modules the user doesn't have access to
      if (text.includes('not authorised to view billing information')) return;
      console.log('PAGE LOG:', text);
    });
    await this.page.setViewport({ width: 1280, height: 800 });

    const loginUrl = this.getUrl('/login.jsp');
    await this.page.goto(loginUrl, {
      waitUntil: 'networkidle2',
      timeout: 90000,
    });

    if (
      this.config.credentials?.username &&
      this.config.credentials?.password
    ) {
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
        if (this.page) {
          const screenshotPath = path.join(this.getWorkDirPath(), 'zuri_login_failed.png');
          await this.page.screenshot({ path: screenshotPath });
          console.error(`Login failed. Screenshot saved to ${screenshotPath}`);
        }
        throw e;
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  async listProperties(): Promise<string[]> {
    if (!this.page) throw new Error('Connector not connected');

    const ids = new Set<string>();

    const currentUrl = this.page.url();
    if (currentUrl.includes('property_id=')) {
      const urlObj = new URL(currentUrl);
      const pid = urlObj.searchParams.get('property_id');
      if (pid) ids.add(pid);
    }

    const scanPage = async () => {
      const found = await this.page!.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a, option, .nav-link'));
        const discovered = new Set<string>();
        links.forEach((el) => {
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
      found.forEach((id) => ids.add(id));
    };

    await scanPage();

    if (ids.size === 0) {
      await this.page.goto(this.getUrl('/SelectProperty'), {
        waitUntil: 'networkidle2',
        timeout: 30000,
      }).catch(() => {});
      await scanPage();
    }

    return Array.from(ids).sort();
  }

  async fetchData(params: { propertyId: string }): Promise<ZuriLeaseData> {
    if (!this.page) throw new Error('Connector not connected');

    const property = await this.fetchPropertyDetails(params.propertyId);
    if (!property.code && !property.alias) {
      return { property, units: [], tenants: [], payments: [] };
    }

    const units = await this.fetchUnits(params.propertyId);
    let payments: ZuriLeasePayment[] = [];
    try {
      payments = await this.fetchRemittances(params.propertyId);
    } catch (e) {}

    for (const unit of units) {
      if (unit.occupancyTenantName) {
        unit.leases = await this.fetchUnitLeases(params.propertyId, unit.unitId);
      }
    }

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

    if (tenantIds.length > 0) {
      await this.warmupReportingSession(tenantIds[0]);
    }

    for (const tid of tenantIds) {
      try {
        const details = await this.fetchTenantDetails(tid);
        const statement = await this.fetchTenantStatement(tid);
        if (details) {
          tenants.push({
            ...details,
            receipts: statement.receipts,
            invoices: statement.invoices,
          } as ZuriLeaseTenant);
        }
      } catch (e) {}
    }

    return { property, units, tenants, payments };
  }

  private async warmupReportingSession(tenantId: string): Promise<void> {
    if (!this.page) return;

    await this.page.goto(this.getUrl('/index.jsp'), { waitUntil: 'networkidle2' });
    await this.page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, .nav-link'));
      const tenantsTab = links.find((l) => (l.textContent || '').trim().toUpperCase() === 'TENANTS');
      if (tenantsTab) (tenantsTab as any).click();
    });

    await new Promise((r) => setTimeout(r, 2000));

    await this.page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, p, span, button'));
      const billingLink = links.find((el) => (el.textContent || '').trim() === 'Billing');
      if (billingLink) (billingLink as any).click();
    });

    await new Promise((r) => setTimeout(r, 3000));

    const now = new Date();
    const formattedDate = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()}`;
    const reportUrl = this.getUrl(
      `/DisplayReport?tenant_id=${tenantId}&format=HTML&report=TenantAccountingStatement&start_date=2000-01-01&end_date=${encodeURIComponent(formattedDate)}`,
    );

    try {
      await this.page.goto(reportUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
        referer: this.getUrl('/index.jsp'),
      });
    } catch (e) {}
  }

  private async fetchTenantStatement(
    tenantId: string,
  ): Promise<{ receipts: ZuriLeaseReceipt[]; invoices: ZuriLeaseInvoice[] }> {
    if (!this.page || !this.browser) return { receipts: [], invoices: [] };

    const downloadPath = path.join(this.getWorkDirPath(), 'temp_downloads');
    if (!fs.existsSync(downloadPath)) fs.mkdirSync(downloadPath, { recursive: true });

    try {
      const downloadPage = await this.browser.newPage();
      const pageClient = await downloadPage.target().createCDPSession();
      await pageClient.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath,
      });

      const now = new Date();
      const formattedDate = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()}`;
      const reportUrl = this.getUrl(
        `/DisplayReport?tenant_id=${tenantId}&format=HTML&report=TenantAccountingStatement&start_date=2000-01-01&end_date=${encodeURIComponent(formattedDate)}`,
      );

      try {
        await downloadPage.goto(reportUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      } catch (e: any) {
        if (!e.message.includes('ERR_ABORTED')) throw e;
      }

      let filePath = '';
      for (let i = 0; i < 15; i++) {
        const files = fs.readdirSync(downloadPath);
        const reportFile = files.find((f) => f.includes('TenantAccountingStatement') && !f.endsWith('.crdownload'));
        if (reportFile) {
          filePath = path.join(downloadPath, reportFile);
          break;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }

      if (!filePath) {
        await downloadPage.close();
        return { receipts: [], invoices: [] };
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      fs.unlinkSync(filePath);
      await downloadPage.close();

      if (!content || content.length < 10) return { receipts: [], invoices: [] };

      const rows: string[][] = content.split('\n').map((line) => {
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

      const receipts: any[] = [];
      const invoices: any[] = [];

      rows.forEach((cols) => {
        if (cols.length < 5) return;
        const dateIdx = cols.findIndex((c) => /^\d{1,2}-[A-Za-z]{3,9}-\d{4}$/.test(c.trim()));
        if (dateIdx === -1) return;
        const date = cols[dateIdx].trim();
        const codeIdx = cols.findIndex((c, i) => i > dateIdx && /INV|RCT|BILL|PAY|SI\d+|SJ\d+|RCT/.test(c.toUpperCase()));
        if (codeIdx === -1) return;
        const code = cols[codeIdx].trim();
        const descIdx = cols.findIndex((c, i) => i > codeIdx && c.trim().length > 1);
        const desc = descIdx !== -1 ? cols[descIdx].trim() : '';
        const values = cols
          .map((c, i) => ({ val: c.trim(), idx: i }))
          .filter((o) => o.idx > codeIdx && /^\(?[\d,.]+\)?$/.test(o.val) && o.val.match(/\d/))
          .map((o) => ({ amount: parseFloat(o.val.replace(/[(),]/g, '')) || 0, idx: o.idx, raw: o.val }))
          .filter((v) => v.amount !== 0);

        if (values.length === 0) return;
        const amount = values[0].amount;

        if (code.toUpperCase().includes('INV') || code.toUpperCase().includes('BILL')) {
          invoices.push({ code, date, dueDate: date, amount, description: desc, status: 'PAID' });
        } else if (code.toUpperCase().includes('RCT') || code.toUpperCase().includes('PAY')) {
          receipts.push({ code, date, amount, description: desc, status: 'CLEARED' });
        }
      });
      return { receipts, invoices };
    } catch (e) {
      return { receipts: [], invoices: [] };
    }
  }

  private async navigateToTenants(): Promise<void> {
    if (!this.page) return;
    await this.page.goto(this.getUrl('/index.jsp'), { waitUntil: 'networkidle2' });
    await this.page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button, li, .nav-link'));
      const link = links.find((l) => l.textContent?.trim().toUpperCase() === 'TENANTS');
      if (link) (link as any).click();
    });
    await this.page.waitForSelector('table', { timeout: 10000 }).catch(() => {});
  }

  private async fetchPropertyDetails(propertyId: string): Promise<ZuriLeaseProperty> {
    if (!this.page) throw new Error('Connector not connected');
    await this.page.goto(this.getUrl(`/SelectProperty?property_id=${propertyId}`), { waitUntil: 'networkidle0', timeout: 90000 });
    const isAccessError = await this.page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes('access error') || text.includes('not authorized') || text.includes('no search results');
    });

    if (isAccessError) return { id: propertyId } as ZuriLeaseProperty;

    const details = (await this.page.evaluate(`(function() {
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
        location: { country: getVal('Country'), town: getVal('Town'), area: getVal('Area') },
        landlord: { id: getVal('L/L No'), name: getVal('Name') }
      };
    })()`)) as any;

    return { id: propertyId, ...details } as ZuriLeaseProperty;
  }

  private async fetchUnits(propertyId: string): Promise<ZuriLeaseUnit[]> {
    if (!this.page) throw new Error('Connector not connected');
    await this.page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('a, button, li'));
        const unitTab = tabs.find(t => t.textContent?.trim() === 'Units');
        if (unitTab) (unitTab as any).click();
    });
    await new Promise(r => setTimeout(r, 2000));
    return (await this.page.evaluate(`(function() {
        const table = document.querySelector('table');
        if (!table) return [];
        const rows = Array.from(table.querySelectorAll('tr')).slice(1);
        return rows.map(r => {
            const cols = r.querySelectorAll('td');
            if (cols.length < 2) return null;
            const link = r.querySelector('a[href*="unit_id="]');
            const id = link ? new URL(link.href, window.location.origin).searchParams.get('unit_id') : '';
            return { unitId: id, unitNumber: cols[0].textContent.trim(), occupancyTenantName: cols[1].textContent.trim() };
        }).filter(u => u !== null);
    })()`)) as ZuriLeaseUnit[];
  }

  private async fetchRemittances(propertyId: string): Promise<ZuriLeasePayment[]> {
    if (!this.page) throw new Error('Connector not connected');
    await this.page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('a, button, li'));
        const remTab = tabs.find(t => t.textContent?.trim() === 'Remittances');
        if (remTab) (remTab as any).click();
    });
    await new Promise(r => setTimeout(r, 2000));
    return (await this.page.evaluate(`(function() {
        const table = document.querySelector('table');
        if (!table) return [];
        const rows = Array.from(table.querySelectorAll('tr')).slice(1);
        return rows.map(r => {
            const cols = r.querySelectorAll('td');
            if (cols.length < 5) return null;
            return { code: cols[0].textContent.trim(), date: cols[1].textContent.trim(), netAmount: parseFloat(cols[cols.length-1].textContent.replace(/,/g, '')) };
        }).filter(p => p !== null);
    })()`)) as ZuriLeasePayment[];
  }

  private async fetchUnitLeases(propertyId: string, unitId: string): Promise<ZuriLeaseLease[]> {
    if (!this.browser) return [];
    const p = await this.browser.newPage();
    await p.goto(this.getUrl(`/SelectUnit?unit_id=${unitId}`), { waitUntil: 'networkidle2' });
    const leases = (await p.evaluate(`(function() {
        const table = document.querySelector('#tenant');
        if (!table) return [];
        const rows = Array.from(table.querySelectorAll('tr')).slice(1);
        return rows.map(r => {
            const cols = r.querySelectorAll('td');
            const link = r.querySelector('a[href*="tenant_id="]');
            const tid = link ? new URL(link.href, window.location.origin).searchParams.get('tenant_id') : '';
            return { tenantId: tid, tenantName: cols[1].textContent.trim(), startDate: cols[2].textContent.trim() };
        });
    })()`)) as ZuriLeaseLease[];
    await p.close();
    return leases;
  }

  private async fetchTenantDetails(tenantId: string): Promise<any> {
    if (!this.page) return null;
    await this.page.goto(this.getUrl(`/SelectTenant?tenant_id=${tenantId}`), { waitUntil: 'networkidle2' });
    return (await this.page.evaluate(`(function() {
        return {
            id: '${tenantId}',
            firstName: document.querySelector('h1, h2')?.textContent?.split(' ')[0] || '',
            phone: '', // Needs deeper scrape or API
        };
    })()`));
  }

  private async dismissModals(): Promise<void> {
    if (!this.page) return;
    await this.page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, a'));
        const close = btns.find(b => ['Close', 'Later', '×'].includes(b.textContent?.trim() || ''));
        if (close) (close as any).click();
    });
  }
}
