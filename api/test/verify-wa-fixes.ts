import 'dotenv/config';
import { Pool } from 'pg';
const API_URL = 'http://127.0.0.1:4001';

async function sendWebhook(from: string, text: string, messageId: string) {
  console.log(`\nSending webhook from ${from}: "${text}" (id: ${messageId})`);
  const body = {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  from,
                  id: messageId,
                  type: 'text',
                  text: { body: text },
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };

  const res = await fetch(`${API_URL}/messaging/whatsapp/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error(`Error: ${res.status} ${res.statusText}`);
    return;
  }

  const data = await res.json();
  console.log('Response:', data);
}

async function main() {
  const testPhone = '254705660625'; // Valid COMPANY_ADMIN

  // Test 1: Onboarding Hallucination
  console.log('--- Test 1: Onboarding Hallucination ---');
  await sendWebhook(
    testPhone,
    'I want to create a property called "Antigravity Heights" with 15 units',
    'wamid.test.new.1',
  );

  // Wait for background process
  console.log('Waiting 10s for background processing...');
  await new Promise((r) => setTimeout(r, 10000));

  // Test 2: Deduplication
  console.log('\n--- Test 2: Deduplication ---');
  await sendWebhook(testPhone, 'Duplicate message', 'wamid.test.dup.new');
  await sendWebhook(testPhone, 'Duplicate message', 'wamid.test.dup.new');
}

main().catch(console.error);
