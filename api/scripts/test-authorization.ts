import puppeteer from 'puppeteer';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || '/home/chris/.cache/puppeteer/chrome/linux-146.0.7680.76/chrome-linux64/chrome',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  console.log('Logging in...');
  await page.goto('https://sak.zurilease.app/login.jsp');
  await page.evaluate(() => {
    (document.querySelector('#username') as any).value = 'matere chris';
    (document.querySelector('input[name="my_password"]') as any).value = 'Matere@2025';
    (document.querySelector('button[type="submit"]') as any).click();
  });
  await page.waitForSelector('#mainTabContent', { timeout: 30000 });
  console.log('Login successful.');

  const propertyId = '0019';
  console.log(`Navigating to property ${propertyId}...`);
  await page.goto(`https://sak.zurilease.app/SelectProperty?property_id=${propertyId}`, { waitUntil: 'networkidle0' });

  console.log('Attempting to click Units tab...');
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('a, button, li'));
    const unitTab = tabs.find(t => t.textContent?.includes('Units'));
    if (unitTab) (unitTab as any).click();
  });

  await new Promise(r => setTimeout(r, 5000));
  const hasUnitsTable = await page.evaluate(() => !!document.querySelector('#units'));
  console.log('Units table found:', hasUnitsTable);

  if (!hasUnitsTable) {
      console.log('Units table NOT found. Taking screenshot...');
      await page.screenshot({ path: 'scripts/auth_debug.png' });
  }

  await browser.close();
}

main();
