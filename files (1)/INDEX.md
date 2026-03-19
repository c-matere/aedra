# Aedra Golden Dataset
## The source of truth for system correctness

Every test case here represents a real interaction that was observed,
verified, and locked in. When a test case passes, the system is
working correctly. When it fails, something broke.

**This file is the index. Never edit test cases directly here —
edit the individual files in each category.**

---

## How this works

```
test/golden/
├── INDEX.md                    ← you are here
├── README.md                   ← how to run and add tests
├── cases/
│   ├── 01-intent-classification.md
│   ├── 02-emergency-escalation.md
│   ├── 03-payment-detection.md
│   ├── 04-list-navigation.md
│   ├── 05-greeting-menus.md
│   ├── 06-tool-manifest.md
│   ├── 07-response-formatting.md
│   ├── 08-swahili-bilingual.md
│   ├── 09-voice-notes.md
│   ├── 10-regression-bugs.md
│   └── 11-edge-cases.md
├── schema.md                   ← how to write a test case
└── ci-checklist.md             ← what to run before deploying
```

---

## Pass rate targets

| Category | Target | Meaning if missed |
|---|---|---|
| Emergency escalation | 100% | Physical safety risk — hard block |
| Payment detection | 99% | Financial flow broken |
| Intent classification | 95% | Routing degraded |
| Response formatting | 95% | User experience broken |
| Tool manifest | 100% | Data never fetched |
| Swahili / bilingual | 90% | Informal agent segment failing |
| Regression bugs | 100% | Known bug reintroduced — hard block |

---

## Current test case count

| File | Cases | Last updated |
|---|---|---|
| 01-intent-classification | 24 | 2026-03-16 |
| 02-emergency-escalation | 16 | 2026-03-16 |
| 03-payment-detection | 14 | 2026-03-16 |
| 04-list-navigation | 8 | 2026-03-16 |
| 05-greeting-menus | 6 | 2026-03-16 |
| 06-tool-manifest | 10 | 2026-03-16 |
| 07-response-formatting | 7 | 2026-03-16 |
| 08-swahili-bilingual | 12 | 2026-03-16 |
| 09-voice-notes | 5 | 2026-03-16 |
| 10-regression-bugs | 8 | 2026-03-16 |
| 11-edge-cases | 9 | 2026-03-16 |
| **Total** | **119** | |

---

## The rule

> If you observed it in production and it was correct — add it.
> If you observed it in production and it was wrong — fix it, then add the correct version.
> Never delete a test case. Mark it `DEPRECATED` if it no longer applies.
