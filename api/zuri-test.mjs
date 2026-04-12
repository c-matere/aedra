/**
 * Zuri Lease Connector — standalone scrape test
 * Usage: ZURI_DOMAIN=... ZURI_USER=... ZURI_PASS=... ZURI_PROP_ID=... node zuri-test.mjs
 *
 * No DB writes — pure scrape validation.
 */
import puppeteer from 'puppeteer';

const DOMAIN      = process.env.ZURI_DOMAIN   || 'REPLACE_ME';
const USERNAME    = process.env.ZURI_USER     || 'REPLACE_ME';
const PASSWORD    = process.env.ZURI_PASS     || 'REPLACE_ME';
const PROPERTY_ID = process.env.ZURI_PROP_ID  || 'REPLACE_ME';

// ── helpers ──────────────────────────────────────────────────────────────────

async function dismissModals(page) {
  try {
    await page.evaluate(function() {
      var btns = Array.from(document.querySelectorAll('button, a'));
      var b = btns.find(function(b) {
        return b.textContent && (b.textContent.includes('Later') || b.textContent.includes('Close'));
      });
      if (b) b.click();
    });
    await new Promise(function(r) { setTimeout(r, 800); });
  } catch (_) {}
}

/** Row-based value extractor — serialised as a real function, no string templates */
function makeGetVal() {
  return function getVal(label) {
    var rows = Array.from(document.querySelectorAll('tr'));
    var ll = label.toLowerCase();
    var row = rows.find(function(r) {
      var f = r.querySelector('td:first-child,th:first-child');
      return f && f.textContent && f.textContent.trim().toLowerCase().startsWith(ll);
    });
    if (row) { var l = row.querySelector('td:last-child'); return l ? l.textContent.trim() : ''; }
    var els = Array.from(document.querySelectorAll('td,th,b,strong,span'));
    var el = els.find(function(e) { return e.textContent && e.textContent.trim().toLowerCase() === ll; });
    if (el) {
      if (el.nextElementSibling) return el.nextElementSibling.textContent.trim();
      var tr = el.closest('tr');
      if (tr) { var l = tr.querySelector('td:last-child'); return l ? l.textContent.trim() : ''; }
    }
    return '';
  };
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  if ([DOMAIN, USERNAME, PASSWORD, PROPERTY_ID].includes('REPLACE_ME')) {
    console.error('Set ZURI_DOMAIN, ZURI_USER, ZURI_PASS, ZURI_PROP_ID env vars');
    process.exit(1);
  }

  console.log('\n🔗  Connecting to https://' + DOMAIN + ' ...');
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/home/chris/.cache/puppeteer/chrome/linux-146.0.7680.76/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // ── Login ──────────────────────────────────────────────────────────────────
  await page.goto('https://' + DOMAIN + '/login.jsp', { waitUntil: 'networkidle2', timeout: 60000 });
  await page.evaluate(function(u, p) {
    var uf = document.querySelector('#username');
    var pf = document.querySelector('input[name="my_password"]');
    if (uf) uf.value = u;
    if (pf) pf.value = p;
    var btn = document.querySelector('button[type="submit"],input[type="submit"]');
    if (btn) btn.click();
  }, USERNAME, PASSWORD);

  try {
    await Promise.race([
      page.waitForSelector('#mainTabContent', { timeout: 60000 }),
      page.waitForSelector('.navbar',         { timeout: 60000 }),
    ]);
    console.log('✅  Login successful');
  } catch (e) {
    await page.screenshot({ path: '/home/chris/aedra/api/zuri_login_fail.png' });
    console.error('❌  Login failed — screenshot saved to zuri_login_fail.png');
    await browser.close();
    process.exit(1);
  }
  await dismissModals(page);

  // ── Property Details ───────────────────────────────────────────────────────
  console.log('\n📋  Fetching property ' + PROPERTY_ID + ' ...');
  await page.goto('https://' + DOMAIN + '/SelectProperty?property_id=' + PROPERTY_ID, {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  const property = await page.evaluate(function() {
    function gv(label) {
      var rows = Array.from(document.querySelectorAll('tr'));
      var ll = label.toLowerCase();
      var row = rows.find(function(r) {
        var f = r.querySelector('td:first-child,th:first-child');
        return f && f.textContent && f.textContent.trim().toLowerCase().startsWith(ll);
      });
      return row ? (row.querySelector('td:last-child') ? row.querySelector('td:last-child').textContent.trim() : '') : '';
    }
    return {
      code: gv('Code'), alias: gv('Alias'), plotNo: gv('Plot No'),
      type: gv('Class'),  // 'Type' picks up nav tabs; use 'Class' or specific label
      category: gv('Category'),
      location: { country: gv('Country'), region: gv('Region'), town: gv('Town'), area: gv('Area') },
      landlord: { id: gv('L/L No'), name: gv('Name') },
    };
  });
  console.log('Property:', JSON.stringify(property, null, 2));

  // ── Units ──────────────────────────────────────────────────────────────────
  console.log('\n🏠  Fetching units ...');
  await dismissModals(page);
  await page.evaluate(function() {
    var tabs = Array.from(document.querySelectorAll('a,button'));
    var t = tabs.find(function(t) { return t.textContent && t.textContent.includes('Units'); });
    if (t) t.click();
  });
  await page.waitForSelector('#units', { timeout: 8000 }).catch(function() {});

  const units = await page.evaluate(function() {
    var table = document.querySelector('#units');
    if (!table) return [];
    return Array.from(table.querySelectorAll('tr')).slice(1).map(function(row) {
      var cols = row.querySelectorAll('td');
      if (cols.length < 5) return null;
      var ul = cols[0] ? cols[0].querySelector('a') : null;
      var unitId = ul && ul.href ? new URL(ul.href, window.location.origin).searchParams.get('unit_id') : '';
      // Occupancy = col 4 (Code|UnitType|Rent&SC|Payable|Occupancy|TenantBalance)
      var occ = cols[4] || cols[3];
      var tl = occ ? occ.querySelector('a') : null;
      var tenantId = tl && tl.href ? new URL(tl.href, window.location.origin).searchParams.get('tenant_id') : '';
      var occText = occ ? occ.textContent.trim() : '';
      var vacant = occText.toLowerCase().startsWith('vacant');
      return {
        unitId: unitId,
        unitCode: cols[0] ? cols[0].textContent.trim() : '',
        unitType: cols[1] ? cols[1].textContent.trim() : '',
        rent: parseFloat((cols[2] ? cols[2].textContent : '0').replace(/,/g, '') || '0'),
        occupancyTenantName: vacant ? '' : occText,
        occupancyTenantId: vacant ? '' : tenantId,
        balance: parseFloat((cols[5] ? cols[5].textContent : (cols[4] ? cols[4].textContent : '0')).replace(/,/g, '') || '0'),
      };
    }).filter(Boolean);
  });

  const occupied = units.filter(function(u) { return u.occupancyTenantId; });
  console.log('Found ' + units.length + ' units — ' + occupied.length + ' occupied, ' + (units.length - occupied.length) + ' vacant');
  units.slice(0, 5).forEach(function(u) { console.log('  ', JSON.stringify(u)); });

  // ── Unit Leases (up to 3 units) ────────────────────────────────────────────
  for (var i = 0; i < Math.min(occupied.length, 3); i++) {
    var unit = occupied[i];
    console.log('\n📄  Leases for unit ' + unit.unitCode + ' (id=' + unit.unitId + ') ...');
    var up = await browser.newPage();
    await up.setViewport({ width: 1280, height: 800 });
    await up.goto('https://' + DOMAIN + '/SelectUnit?unit_id=' + unit.unitId, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await up.waitForSelector('#tenant', { timeout: 5000 }).catch(function() {});

    // Also dump the raw lease table HTML to understand the tenantId link format
    var rawLeaseHtml = await up.evaluate(function() {
      var t = document.querySelector('#tenant');
      return t ? t.innerHTML.substring(0, 2000) : 'NO #tenant TABLE';
    });
    console.log('  Raw lease table HTML:\n', rawLeaseHtml);

    var leases = await up.evaluate(function() {
      var table = document.querySelector('#tenant');
      if (!table) return [];
      return Array.from(table.querySelectorAll('tr')).slice(1).map(function(row) {
        var cols = row.querySelectorAll('td');
        if (cols.length < 3) return null;
        // Try to find a tenant link anywhere in the row
        var allLinks = Array.from(row.querySelectorAll('a'));
        var tenantLink = allLinks.find(function(a) { return a.href && a.href.includes('tenant_id'); });
        var tenantId = tenantLink ? new URL(tenantLink.href, window.location.origin).searchParams.get('tenant_id') : '';
        return {
          tenantId: tenantId,
          tenantName: cols[1] ? cols[1].textContent.trim() : '',
          unitCode: cols[0] ? cols[0].textContent.trim() : '',
          startDate: cols[2] ? cols[2].textContent.trim() : '',
          endDate: cols[3] ? cols[3].textContent.trim() : '',
          status: cols[4] ? cols[4].textContent.trim() : '',
        };
      }).filter(Boolean);
    });
    console.log('  Leases:', JSON.stringify(leases, null, 2));
    await up.close();
  }

  // ── Tenant Details (up to 3 tenants) ──────────────────────────────────────
  var tenantIds = Array.from(new Set(occupied.map(function(u) { return u.occupancyTenantId; }).filter(Boolean)));
  console.log('\n👤  Fetching details for ' + Math.min(tenantIds.length, 3) + ' of ' + tenantIds.length + ' tenant(s) ...');

  for (var j = 0; j < Math.min(tenantIds.length, 3); j++) {
    var tid = tenantIds[j];
    console.log('\n  Tenant ' + tid + ':');
    var tp = await browser.newPage();
    await tp.setViewport({ width: 1280, height: 800 });
    await tp.goto('https://' + DOMAIN + '/SelectTenant?tenant_id=' + tid, { waitUntil: 'domcontentloaded', timeout: 60000 });

    var details = await tp.evaluate(function() {
      function getVal(label) {
        var rows = Array.from(document.querySelectorAll('tr'));
        var ll = label.toLowerCase();
        var row = rows.find(function(r) {
          var f = r.querySelector('td:first-child,th:first-child');
          return f && f.textContent && f.textContent.trim().toLowerCase().startsWith(ll);
        });
        if (row) { var l = row.querySelector('td:last-child'); return l ? l.textContent.trim() : ''; }
        var els = Array.from(document.querySelectorAll('td,th,b,strong,span'));
        var el = els.find(function(e) { return e.textContent && e.textContent.trim().toLowerCase() === ll; });
        if (el) {
          if (el.nextElementSibling) return el.nextElementSibling.textContent.trim();
          var tr = el.closest('tr');
          if (tr) { var l = tr.querySelector('td:last-child'); return l ? l.textContent.trim() : ''; }
        }
        return '';
      }

      var phone = getVal('Primary Tel') || getVal('Primary Tel.') || getVal('Tel') ||
                  getVal('Phone') || getVal('Mobile') || getVal('Contact');
      var unitVal = getVal('Unit');
      var unitParts = unitVal ? unitVal.split(':').map(function(s) { return s.trim(); }) : [];

      // Dump raw rows for debugging
      var rawRows = Array.from(document.querySelectorAll('tr')).slice(0, 40).map(function(r) {
        return Array.from(r.querySelectorAll('td,th')).map(function(c) { return c.textContent.trim(); });
      }).filter(function(r) { return r.some(function(c) { return c.length > 0; }) });

      return {
        name: getVal('Name'),
        idNo: getVal('ID No.') || getVal('ID No') || getVal('ID Number'),
        phone: phone,
        rent: getVal('Rent'),
        depositHeld: getVal('Deposit Held'),
        leaseStart: getVal('Start') || getVal('Start Date'),
        leaseEnd: getVal('End') || getVal('End Date'),
        unitCode: unitParts[0] || '',
        unitName: unitParts[1] || '',
        paymentFrequency: getVal('Mode') || getVal('Frequency'),
        _rawRows: rawRows,
      };
    });

    var rawRows = details._rawRows;
    delete details._rawRows;
    console.log('  Details:', JSON.stringify(details, null, 4));
    console.log('  Raw table rows (first 40):');
    rawRows.forEach(function(r) { console.log('   ', JSON.stringify(r)); });
    await tp.close();
  }

  console.log('\n✅  Test complete.\n');
  await browser.close();
}

main().catch(function(e) { console.error('Fatal:', e); process.exit(1); });
