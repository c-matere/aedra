# Aedra Golden Dataset
## How to use this, add to it, and keep it honest

---

## What this is

A versioned, queryable record of every interaction that proves
the system is working correctly. Every test case here was either:

- Observed in production and verified correct
- Constructed to prevent a known bug from recurring
- Built to cover a critical path that must never break

---

## The one rule

> **Every production bug becomes a permanent test case.**

When something breaks in production, fix it, then write a test
case that would have caught it. Add it here. It stays forever.

This is how the system gets more reliable over time rather than
accumulating silent regressions.

---

## File structure

```
test/golden/
├── INDEX.md              ← master index and pass rate targets
├── README.md             ← this file
├── schema.md             ← how to write a test case
├── ci-checklist.md       ← what to run before deploying
└── cases/
    ├── 01-intent-classification.md
    ├── 02-emergency-escalation.md
    ├── 03-payment-detection.md
    ├── 04-list-navigation.md
    ├── 05-greeting-menus.md
    ├── 06-tool-manifest.md
    ├── 07-response-formatting.md
    ├── 08-swahili-bilingual.md
    ├── 09-voice-notes.md
    ├── 10-regression-bugs.md
    └── 11-edge-cases.md
```

---

## How test cases map to code

Each markdown test case maps to one or more automated tests:

```
Golden dataset (markdown)     →  Automated test (code)
─────────────────────────────────────────────────────
cases/01-intent-*.md          →  src/unit/intent-classifier.spec.ts
cases/02-emergency-*.md       →  src/unit/validators.spec.ts
cases/10-regression-*.md      →  src/integration/contract-tests.spec.ts
cases/*/                      →  src/ai/promptfoo.yaml
```

The markdown is the **source of truth**.
The code test is the **automated enforcement**.

When you add a markdown test case, also add it to the
corresponding code test file. They must stay in sync.

---

## How to add a new test case

### Step 1 — Write the markdown

Copy the template from `schema.md` into the correct category file.

Fill in:
- What the user sent
- What role and context
- What must happen
- What must never happen
- The correct output (locked)

### Step 2 — Add to the code test

For intent/classification cases → `src/unit/intent-classifier.spec.ts`
For validator cases → `src/unit/validators.spec.ts`
For pipeline cases → `src/integration/whatsapp-pipeline.spec.ts`
For contract cases → `src/integration/contract-tests.spec.ts`
For AI quality → `src/ai/promptfoo.yaml`

### Step 3 — Update INDEX.md count

Increment the count for the affected category file.

### Step 4 — Run the test

Verify it passes before committing.

---

## How to read test case priorities

**P0 — Hard block**
If this test fails, the deployment stops. No exceptions.
Examples: emergency escalation, financial data integrity,
privacy isolation, known regression bugs.

**P1 — High**
If this test fails, investigate before deploying.
Examples: common intent classification, payment detection,
list navigation, Swahili responses.

**P2 — Medium**
If this test fails, log and monitor. Deploy with awareness.
Examples: edge cases, rare intents, formatting details.

---

## The relationship between this and your CI pipeline

```
git commit
    ↓
Pre-commit: tsc --noEmit (compilation must be clean)
    ↓
PR: jest unit + integration (must pass)
    ↓
Deploy: jest regression P0 cases (must be 100%)
    ↓
Model update: promptfoo golden set (must be >= 95%)
    ↓
1st of month: k6 surge test (must meet SLAs)
```

---

## Current status — what today's testing revealed

All cases below were discovered during live testing on 2026-03-16
and are now locked in the regression suite.

| Bug ID | What broke | Fixed | Test case |
|---|---|---|---|
| R001 | list_companies complexity=3, 71s response | ✅ | TC-REG-001 |
| R002 | COMPANY_STAFF 0 tools loaded | ✅ | TC-REG-002 |
| R003 | "interested in X" → payment flow | ✅ | TC-REG-003 |
| R004 | Ghost delivery — duplicate response | 🔄 | TC-REG-004 |
| R005 | Groq 400 empty tool result content | 🔄 | TC-REG-005 |
| R006 | Degradation notice on working fallback | 🔄 | TC-REG-006 |
| R007 | Double model initialization | 🔄 | TC-REG-007 |
| R008 | Voice note classified before transcription | 🔄 | TC-REG-008 |

✅ Fixed · 🔄 In progress · ❌ Open

---

## The long-term vision

As the system grows, this dataset grows with it.

Today: 119 test cases covering the first day of testing.
Month 3: 300+ cases covering all common agent workflows.
Month 12: 1000+ cases covering edge cases from real
Mombasa agent interactions.

At that point, this dataset becomes something more valuable
than any individual test file — it is the institutional memory
of everything the system has learned from real use.

It is also the foundation for HomeQL's validation layer —
when you build the market intelligence product, the same
discipline of locked test cases with observed correct outputs
applies to every data query the system handles.

The habit starts today. One test case per bug. One test case
per verified correct interaction. Forever.
