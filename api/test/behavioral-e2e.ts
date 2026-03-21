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

async function runStep(
  token: string,
  msg: string,
  history: any[],
  chatId?: string,
) {
  console.log(`\n\x1b[33mUser:\x1b[0m ${msg}`);

  // Add a delay between requests
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const res = await fetch(`${API_URL}/ai/chat`, {
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
  });

  if (!res.ok) {
    const errorData = await res
      .json()
      .catch(() => ({ message: res.statusText }));
    throw new Error(`API Error: ${errorData.message || res.statusText}`);
  }

  const data = await res.json();
  console.log(`\x1b[32mAI:\x1b[0m ${data.response}`);
  return data;
}

async function main() {
  console.log('\x1b[36m=== Starting Behavioral E2E Journey ===\x1b[0m');

  const user = await prisma.user.findFirst({
    where: { role: UserRole.SUPER_ADMIN },
  });
  if (!user) throw new Error('No Super Admin found for testing.');

  const token = createSessionToken({ userId: user.id, role: user.role });
  let history: any[] = [];
  let chatId: string | undefined = undefined;

  try {
    // Step 1: Greeting
    const step1 = await runStep(token, 'hello', history, chatId);
    history = step1.history;
    chatId = step1.chatId;

    // Step 2: List Companies
    const step2 = await runStep(token, 'list companies', history, chatId);
    history = step2.history;

    // Step 3: Select Company (Simulating user choosing company #4 or last available if less)
    // We'll peek at the response to see if we can find a company ID or just say "company #4"
    const step3 = await runStep(
      token,
      'I am interested in company 4',
      history,
      chatId,
    );
    history = step3.history;

    // Step 4: Add Property
    const step4 = await runStep(
      token,
      "add a property called 'Simulated Growth Tower' in downtown Nairobi in this company",
      history,
      chatId,
    );
    history = step4.history;

    // Wait for confirmation request if any
    if (step4.response.toLowerCase().includes('confirm')) {
      const step4b = await runStep(token, 'confirmed', history, chatId);
      history = step4b.history;
    }

    // Step 5: Add Tenant
    const step5 = await runStep(
      token,
      "add a tenant called 'John Behavioral' to this new property",
      history,
      chatId,
    );
    history = step5.history;

    if (step5.response.toLowerCase().includes('confirm')) {
      const step5b = await runStep(token, 'confirmed', history, chatId);
      history = step5b.history;
    }

    // Step 6: Delete Tenant (Expected to likely fail or reveal missing tool)
    const step6 = await runStep(
      token,
      'delete the tenant John Behavioral',
      history,
      chatId,
    );
    history = step6.history;

    // Step 7: Reports
    const step7 = await runStep(
      token,
      'generate a financial report for this company',
      history,
      chatId,
    );
    history = step7.history;
  } catch (err: any) {
    console.error(`\x1b[31mJourney Interrupted:\x1b[0m ${err.message}`);
  }
}

main()
  .catch((err) => console.error(err))
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
