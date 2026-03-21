import { WordNetIntentResolver } from '../src/ai/wordnet-intent-resolver.util';
import 'dotenv/config';

async function verify() {
  const resolver = new WordNetIntentResolver();
  await resolver.initialize();

  const testCases = [
    { msg: 'list companies', expected: 'list_companies', route: 'DIRECT' },
    { msg: 'show me companies', expected: 'list_companies', route: 'DIRECT' },
    { msg: 'orodha ya kampuni', expected: 'list_companies', route: 'DIRECT' },
    { msg: 'select alphask', expected: 'select_company', route: 'DIRECT' },
    { msg: 'switch to alphask', expected: 'select_company', route: 'DIRECT' },
    { msg: 'chagua alphask', expected: 'select_company', route: 'DIRECT' },
    { msg: 'list tenants', expected: 'list_tenants', route: 'DIRECT' },
    { msg: 'show me tenants', expected: 'list_tenants', route: 'DIRECT' },
    {
      msg: 'generate mckinsey report',
      expected: 'generate_mckinsey_report',
      route: 'DIRECT',
    },
    {
      msg: 'tengeneza ripoti',
      expected: 'generate_mckinsey_report',
      route: 'DIRECT',
    },
    { msg: "who hasn't paid", expected: 'check_rent_status', route: 'DIRECT' },
    { msg: 'nimetuma pesa', expected: 'record_payment', route: 'DIRECT' },
    { msg: 'bomba imevunjika', expected: 'log_maintenance', route: 'DIRECT' },
    {
      msg: 'I am interested in alphask',
      expected: 'select_company',
      route: 'HINT',
    },
  ];

  console.log('--- WordNet Verification ---');
  let passed = 0;
  for (const tc of testCases) {
    const result = resolver.resolve(tc.msg);
    const isIntentMatch = result.intent === tc.expected;
    const isRouteMatch = result.route === tc.route;

    if (isIntentMatch && isRouteMatch) {
      console.log(
        `✅ PASS: "${tc.msg}" -> ${result.intent} (${result.route}, conf: ${result.confidence.toFixed(2)})`,
      );
      passed++;
    } else {
      console.log(`❌ FAIL: "${tc.msg}"`);
      console.log(`   Expected: ${tc.expected} (${tc.route})`);
      console.log(
        `   Actual:   ${result.intent} (${result.route}, conf: ${result.confidence.toFixed(2)})`,
      );
    }
  }

  console.log(`\nPassed ${passed}/${testCases.length} tests.`);
}

verify().catch(console.error);
