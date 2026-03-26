const rules = [
    {
      id: 'LATE_PAYMENT',
      intent: 'LATE_PAYMENT',
      patterns: [
        /\bpaid\b.*\balready\b/i,
        /\bsent\b.*\bmoney\b/i,
        /\bpaying\b.*\btomorrow\b/i,
        /\bbalance\b.*\barrears\b/i,
        /\bpromise\b.*\bpay\b/i,
        /\bnimeshalipa\b/i,
        /\bnimeshatuma\b/i,
        /\btayari\b.*\b(pesa|sh|ksh)\b/i,
        /\bbalance\b.*\b(yangu|ni)\b/i,
        /\b(deni|arrears)\b/i,
      ],
    },
    {
      id: 'WORKFLOW_DEPENDENCY',
      intent: 'WORKFLOW_DEPENDENCY',
      patterns: [
        /\badd\b.*\bwithout\b.*\bplan\b/i,
        /\bregister\b.*\bno\b.*\bsubscription\b/i,
        /\btenant\b.*\bwithout\b.*\bactive\b/i,
      ],
    },
    {
      id: 'NOISE_COMPLAINT',
      intent: 'NOISE_COMPLAINT',
      patterns: [
        /\bnoise\b.*\bcomplaint\b/i,
        /\bloud\b.*\bneighbor\b/i,
        /\bparty\b.*\bnext door\b/i,
        /\bplaying\b.*\bloud\b/i,
      ],
    },
  ];

function intercept(message) {
    const text = (message || '').toLowerCase();
    for (const rule of rules) {
      for (const pattern of rule.patterns) {
        if (pattern.test(text)) {
          return rule.intent;
        }
      }
    }
    return null;
}

const testCases = [
  { message: "nimeshalipa", expected: "LATE_PAYMENT" },
  { message: "nimeshalipa tayari", expected: "LATE_PAYMENT" },
  { message: "tayari nimeshatuma pesa", expected: "LATE_PAYMENT" },
  { message: "balance yangu ni ngapi", expected: "LATE_PAYMENT" },
  { message: "add John Doe without a plan", expected: "WORKFLOW_DEPENDENCY" },
  { message: "register this unit no subscription", expected: "WORKFLOW_DEPENDENCY" },
  { message: "noise complaint about unit B4", expected: "NOISE_COMPLAINT" },
  { message: "neighbor is playing loud music", expected: "NOISE_COMPLAINT" },
  { message: "hello how are you", expected: null },
];

console.log("--- Firewall Isolation Test ---");
let allPass = true;
for (const tc of testCases) {
  const actual = intercept(tc.message);
  const status = (actual === tc.expected) ? "✓ PASS" : "✗ FAIL";
  if (status.includes("FAIL")) allPass = false;
  console.log(`[${status}] Message: "${tc.message}" | Expected: ${tc.expected || 'null'} | Actual: ${actual || 'null'}`);
}

if (!allPass) process.exit(1);
