import { AiIntentFirewallService } from './api/src/ai/ai-intent-firewall.service';

const firewall = new AiIntentFirewallService();

const testCases = [
  { message: "nimeshalipa", expected: "LATE_PAYMENT" },
  { message: "tayari nimeshatuma pesa", expected: "LATE_PAYMENT" },
  { message: "balance yangu ni ngapi", expected: "LATE_PAYMENT" },
  { message: "add John Doe without a plan", expected: "WORKFLOW_DEPENDENCY" },
  { message: "register this unit no subscription", expected: "WORKFLOW_DEPENDENCY" },
  { message: "noise complaint about unit B4", expected: "NOISE_COMPLAINT" },
  { message: "neighbor is playing loud music", expected: "NOISE_COMPLAINT" },
  { message: "hello how are you", expected: null },
];

console.log("--- Firewall Isolation Test ---");
for (const tc of testCases) {
  const result = firewall.intercept(tc.message);
  const actual = result.isIntercepted ? result.intent : null;
  const status = actual === tc.expected ? "PASS" : "FAIL";
  console.log(`[${status}] Message: "${tc.message}" | Expected: ${tc.expected} | Actual: ${actual}`);
}
