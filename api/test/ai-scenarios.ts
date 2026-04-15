import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createSessionToken } from '../src/auth/session-token';
import { UserRole } from '../src/auth/roles.enum';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const API_URL = 'http://127.0.0.1:4001';

async function runScenario(
  name: string,
  messages: string[],
  expectedKeywords: string[][],
) {
  console.log(`\n\x1b[36m=== Scenario: ${name} ===\x1b[0m`);

  const user = await prisma.user.findFirst({
    where: { role: UserRole.SUPER_ADMIN },
  });
  if (!user) throw new Error('No Super Admin found for testing.');

  const token = createSessionToken({ userId: user.id, role: user.role });
  let chatId: string | undefined = undefined;
  let history: any[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const keywords = expectedKeywords[i];

    console.log(`\x1b[33mUser:\x1b[0m ${msg}`);
    console.log(`\x1b[90m(Waiting for AI...)\x1b[0m`);

    try {
      // Add a small delay between requests to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000); // 1 minute timeout

      const res: any = await fetch(`${API_URL}/ai/chat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: msg,
          history: history,
          chatId: chatId,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errorData = await res
          .json()
          .catch(() => ({ message: res.statusText }));
        throw new Error(errorData.message || res.statusText);
      }

      const resData: any = await res.json();
      const response = resData.response;
      chatId = resData.chatId;
      history = resData.history || [];

      console.log(
        `\x1b[32mAI:\x1b[0m ${response.substring(0, 500)}${response.length > 500 ? '...' : ''}`,
      );

      const foundKeywords = keywords.filter((k) =>
        response.toLowerCase().includes(k.toLowerCase()),
      );
      if (foundKeywords.length === keywords.length) {
        console.log(
          `\x1b[32m✓ Passed (Keywords found: ${foundKeywords.join(', ')})\x1b[0m`,
        );
      } else {
        const missing = keywords.filter(
          (k) => !response.toLowerCase().includes(k.toLowerCase()),
        );
        console.log(`\x1b[31m✗ Failed (Missing: ${missing.join(', ')})\x1b[0m`);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.error(`\x1b[31mError:\x1b[0m Request timed out after 60s`);
      } else {
        console.error(`\x1b[31mError:\x1b[0m ${err.message}`);
      }
    }
  }
}

async function main() {
  console.log('Starting AI Edge Case Scenarios...');

  // Scenario 1: Zero-Context "Self-Healing" Request
  await runScenario(
    'Robust Context Resolution (Zero-Context Start)',
    [
      "add a plumbing maintenance request for Sarah Ali's sink, high priority",
      'confirmed',
    ],
    [
      ['Sarah Ali', 'plumbing'],
      ['successfully', 'created', 'maintenance request'],
    ],
  );

  // Scenario 2: Sticky Routing & Workflow Initiation
  await runScenario(
    'Sticky Routing & Workflow Initiation',
    [
      'I need to fix a leak for Sarah Ali',
      'high priority',
      'confirmed',
      'trigger the maintenance lifecycle for this',
    ],
    [
      ['Sarah Ali', 'priority'],
      ['confirm'],
      ['created', 'maintenance request'],
      ['workflow', 'initiated', 'ACTIVE'],
    ],
  );

  // Scenario 3: Super Admin Multi-Company Search
  await runScenario(
    'Super Admin Cross-Company Search',
    ['who is Sarah Ali?', 'create an invoice for her rent for 1500'],
    [
      ['Sarah Ali', 'tenant'],
      ['invoice', 'confirm', '1500'],
    ],
  );

  // Scenario 4: Super Admin Platform Oversight & Scoped Mutation
  await runScenario(
    'Super Admin Platform Oversight',
    [
      'Who is the tenant in Unit B4 across all properties?',
      'Register a new company called Antigravity Alpha',
    ],
    [
      ['B4', 'tenant'],
      ['register_company', 'Antigravity Alpha'],
    ],
  );
}

main()
  .catch((err) => console.error(err))
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
