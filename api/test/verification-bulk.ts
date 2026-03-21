import 'dotenv/config';
import { createSessionToken } from '../src/auth/session-token';
import { UserRole } from '../src/auth/roles.enum';

const API_URL = 'http://127.0.0.1:4001';

async function verifyBulk() {
  console.log('=== Final Hybrid AI Bulk Verification ===');
  const token = createSessionToken({
    userId: 'c9c79e40-9a71-4de8-8617-86f76936f0c6',
    role: UserRole.SUPER_ADMIN,
  });

  const message =
    'Add 12 residential units to Miller Towers (prop ID 4de42b83-310e-4511-9f0f-79fe8c2cf183) numbered M-101 to M-112. Rent is 1500 each. Use status VACANT. Just do all of them in one go.';

  console.log(`Sending request: "${message}"`);
  const startTime = Date.now();

  try {
    const res = await fetch(`${API_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message,
        history: [],
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('Error:', err);
      return;
    }

    const data = await res.json();
    const duration = (Date.now() - startTime) / 1000;

    console.log(`\nResponse received in ${duration.toFixed(2)}s:`);
    console.log('AI:', data.response);
  } catch (e: any) {
    console.error('Request Failed:', e.message);
  }
}

verifyBulk().catch(console.error);
