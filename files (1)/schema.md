# Test Case Schema
## How to write a golden test case

Every test case follows this exact structure.
Copy the template, fill in the fields, add to the correct file.

---

## Template

```markdown
### TC-[CATEGORY]-[NUMBER]: [Short description]

**Added:** YYYY-MM-DD
**Source:** [production-log | manual-test | bug-report]
**Status:** ACTIVE | DEPRECATED
**Priority:** P0 (hard block) | P1 (high) | P2 (medium)

**Input**
- Message: `exact message text`
- Role: SUPER_ADMIN | AGENT | TENANT | LANDLORD | COMPANY_STAFF
- Language: en | sw | mixed
- Context: [any relevant session state, e.g. previousIntent: list_companies]
- Attachments: none | audio | image | document

**Expected behaviour**
- Intent: `intent_name`
- Complexity: 1 | 2 | 3 | 4 | 5
- Execution mode: DIRECT_LOOKUP | LIGHT_COMPOSE | ORCHESTRATED | INTELLIGENCE
- Tools loaded: [list of expected tools, or count range]
- Response contains: [strings or patterns that must appear]
- Response excludes: [strings or patterns that must NOT appear]
- Response language: en | sw
- Max response time: Xms
- Model called: none | groq | gemini | any

**Must NOT happen**
- [Explicit prohibitions — what would constitute a failure]

**Observed output (locked)**
[The actual correct output from a verified production run.
This is the ground truth. The system must produce this or equivalent.]

**Notes**
[Why this case matters, what bug it prevents, or what edge it covers]
```

---

## Priority levels

**P0 — Hard block on deployment**
Test failure means do not deploy under any circumstances.
Examples: emergency escalation, financial cross-check, cache isolation.

**P1 — High priority**
Test failure means investigate before deploying.
Examples: payment detection, intent accuracy for common flows.

**P2 — Medium priority**
Test failure means log and monitor. Deploy with awareness.
Examples: response formatting edge cases, rare intents.

---

## Source types

**production-log** — observed in real WhatsApp interaction, verified correct
**manual-test** — deliberately constructed to cover a known case
**bug-report** — constructed from a real bug to prevent regression

---

## Naming convention

```
TC-INTENT-001    Intent classification cases
TC-EMERG-001     Emergency escalation cases
TC-PAY-001       Payment detection cases
TC-LIST-001      List navigation cases
TC-GREET-001     Greeting menu cases
TC-TOOLS-001     Tool manifest cases
TC-FORMAT-001    Response formatting cases
TC-SW-001        Swahili/bilingual cases
TC-VOICE-001     Voice note cases
TC-REG-001       Regression bug cases
TC-EDGE-001      Edge cases
```
