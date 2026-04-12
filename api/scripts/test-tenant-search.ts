import puppeteer from 'puppeteer';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || '/home/chris/.cache/puppeteer/chrome/linux-146.0.7680.76/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-quic']
  });
  const page = await browser.newPage();
  
  // Stealth overrides
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  console.log('Logging in...');
  await page.goto('https://sak.zurilease.app/login.jsp');
  await page.evaluate(() => {
    (document.querySelector('#username') as any).value = 'matere chris';
    (document.querySelector('input[name="my_password"]') as any).value = 'Matere@2025';
    (document.querySelector('button[type="submit"]') as any).click();
  });
  await page.waitForSelector('#mainTabContent', { timeout: 30000 });
  console.log('Login successful.');

  console.log('Navigating to Tenants via Sidebar...');
  await page.evaluate(() => {
    const sidebarLinks = Array.from(document.querySelectorAll('a, button, li, .nav-link, span'));
    const tenantLink = sidebarLinks.find(link => link.textContent?.trim().toUpperCase() === 'TENANTS');
    if (tenantLink) (tenantLink as any).click();
    else console.error('Tenants sidebar link NOT found');
  });
  
  await new Promise(r => setTimeout(r, 5000));
  console.log('Current URL:', page.url());

  const hasTable = await page.evaluate(() => !!document.querySelector('table'));
  console.log('Tenant Search Table found:', hasTable);

  if (hasTable) {
    const rows = await page.evaluate(() => {
        const trs = Array.from(document.querySelectorAll('table tr')).slice(1, 10);
        return trs.map(r => (r as HTMLElement).innerText);
    });
    console.log('Sample Rows:', rows);
  } else {
    console.log('Taking screenshot of failure...');
    await page.screenshot({ path: '/home/chris/aedra/api/scripts/tenant_search_fail.png', fullPage: true });
  }

  await browser.close();
}

main();
