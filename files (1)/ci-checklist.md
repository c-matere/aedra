# CI Checklist
## What to verify before every deployment

---

## Before every commit

Run these manually or wire to pre-commit hook:

```bash
# TypeScript must compile clean — no errors
npx tsc --noEmit

# Unit tests must pass
npx jest --testPathPattern=src/unit --passWithNoTests

# Regression tests must all pass (100% required)
npx jest --testPathPattern=src/integration/contract-tests -t Regression
```

---

## Before every deployment to production

```bash
# Full unit + integration suite
npx jest --coverage --forceExit

# Regression hard block — if any fail, stop here
npx jest -t "TC-REG" --forceExit

# Emergency escalation hard block
npx jest -t "TC-EMERG" --forceExit

# Tool manifest hard block
npx jest -t "TC-TOOLS" --forceExit
```

---

## Before any model or prompt change

```bash
# Run full golden set against new model
npx promptfoo eval --config src/ai/promptfoo.yaml

# Pass rate must be >= 95% overall
# Emergency escalation must be 100%
# Regression tests must be 100%

# If below threshold — do NOT deploy model change
```

---

## Before first-of-month (run evening before)

```bash
# Surge load test
k6 run -e SCENARIO=surge src/load/surge-scenarios.js

# Emergency under load
k6 run -e SCENARIO=emergency src/load/surge-scenarios.js

# Thresholds that must pass:
# acknowledged_within_2s: rate > 0.95
# completed_within_60s: rate > 0.90
# emergency_escalation_ms p(99) < 1000ms
# error_rate < 0.05
```

---

## Hard blocks — never deploy if these fail

| Test | Why it blocks |
|---|---|
| TC-EMERG-* (any) | Physical safety |
| TC-REG-* (any) | Known bug reintroduced |
| TC-TOOLS-002 | COMPANY_STAFF gets "No companies found" |
| TC-TOOLS-003 | TENANT can invoke write tools |
| TC-PAY-003 | "Interested in X" triggers payment |
| TC-FORMAT-003 | Ghost deliveries |

---

## Adding a new test case to this checklist

When you observe a bug in production:

1. Fix the bug
2. Write a test case in the appropriate `cases/XX-*.md` file
3. Add the test to the Jest spec file
4. Add to promptfoo.yaml if it's a classifier/response quality test
5. Mark as P0 if it affects safety, financial data, or privacy
6. Update the count in INDEX.md

The rule: **every production bug becomes a permanent test case.**
A bug that happens once must never happen again silently.
