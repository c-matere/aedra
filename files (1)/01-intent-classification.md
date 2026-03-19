# Category 01: Intent Classification
## Golden test cases for intent routing accuracy

These cases validate that the classifier correctly identifies what the
user wants. A wrong classification means the wrong workflow fires.

---

### TC-INTENT-001: List companies — plain EN

**Added:** 2026-03-16
**Source:** production-log
**Status:** ACTIVE
**Priority:** P1

**Input**
- Message: `list companies`
- Role: SUPER_ADMIN
- Language: en
- Context: none

**Expected behaviour**
- Intent: `list_companies`
- Complexity: 1
- Execution mode: DIRECT_LOOKUP
- Tools loaded: `[list_companies]` — exactly 1 tool
- Response contains: company names as numbered list
- Response excludes: UUIDs, raw database IDs
- Max response time: 3000ms
- Model called: groq (or none if DIRECT_LOOKUP bypasses model)

**Must NOT happen**
- Complexity scored as 3 (was the bug in logs at 10:36)
- 51 tools loaded
- Response returns "No companies found" when companies exist

**Observed output (locked)**
```
6 companies found:

1. alphask
2. Ochieng Management No. 5
3. Garcia Management No. 4
4. Smith Management No. 3
5. Abdullah Management No. 2
6. Ochieng Management No. 1

Which company would you like to explore? Reply with a number.
```

**Notes**
This was misclassified as complexity=3 in early logs causing 71s
response time. Must always be complexity=1 DIRECT_LOOKUP.

---

### TC-INTENT-002: List companies — with greeting

**Added:** 2026-03-16
**Source:** production-log
**Status:** ACTIVE
**Priority:** P1

**Input**
- Message: `Hello, list our companies for me`
- Role: SUPER_ADMIN
- Language: en
- Context: none

**Expected behaviour**
- Intent: `list_companies`
- Complexity: 1
- Execution mode: DIRECT_LOOKUP

**Must NOT happen**
- Complexity scored > 1
- Routed to Tier 2 or Tier 3 model

**Notes**
Greeting prefix must not inflate complexity score.

---

### TC-INTENT-003: List companies — numeric reply after menu

**Added:** 2026-03-16
**Source:** production-log
**Status:** ACTIVE
**Priority:** P0

**Input**
- Message: `1`
- Role: SUPER_ADMIN
- Language: en
- Context: previousIntent=greeting_menu, menuOption1=list_companies

**Expected behaviour**
- Intent: `list_companies`
- Execution mode: DIRECT_LOOKUP
- Tools loaded: `[list_companies]` — exactly 1 tool
- Response contains: numbered company list

**Must NOT happen**
- Returns "No companies found" when companies exist
- 0 tools loaded for SUPER_ADMIN (was the bug: 0/56 tools)
- Routes to payment flow

**Observed output (locked)**
```
6 companies found:

1. alphask
2. Ochieng Management No. 5
[...]

Which company would you like to explore? Reply with a number.
```

**Notes**
Critical. Single digit "1" must route via quick action map
not through classifier. Was failing because SUPER_ADMIN
tool manifest for list_companies loaded 0 tools.

---

### TC-INTENT-004: Company interest after list — NOT payment

**Added:** 2026-03-16
**Source:** production-log
**Status:** ACTIVE
**Priority:** P0

**Input**
- Message: `I'm interested in alphask`
- Role: SUPER_ADMIN
- Language: en
- Context: previousIntent=list_companies

**Expected behaviour**
- Intent: `select_company`
- Execution mode: DIRECT_LOOKUP

**Must NOT happen**
- Intent classified as `record_payment` ← THE BUG
- M-Pesa code extracted from "INTERESTED"
- Response: "I see M-Pesa code INTERESTED..."

**Observed output (locked — this was the WRONG output, shown for reference)**
```
WRONG: "I see M-Pesa code INTERESTED, but I haven't received
the confirmation from M-Pesa yet."
```
```
CORRECT: Workspace switched to alphask. What would you like to do?
1. View tenants
2. Check collection
3. Generate report
```

**Notes**
R005 regression. "interested in X" after company listing is
workspace selection, never payment. Payment skill must validate
inputs — no payment signals = reject before executing.

---

### TC-INTENT-005: Arrears check — EN

**Added:** 2026-03-16
**Source:** manual-test
**Status:** ACTIVE
**Priority:** P1

**Input**
- Message: `who has not paid this month`
- Role: AGENT
- Language: en
- Context: none

**Expected behaviour**
- Intent: `check_rent_status`
- Complexity: 1
- Execution mode: DIRECT_LOOKUP
- Response contains: list of unpaid tenants or confirmation all paid

**Must NOT happen**
- Complexity > 2
- Routed to Tier 3 model

---

### TC-INTENT-006: Arrears check — SW

**Added:** 2026-03-16
**Source:** manual-test
**Status:** ACTIVE
**Priority:** P1

**Input**
- Message: `hawajapaya nani mwezi huu`
- Role: AGENT
- Language: sw
- Context: none

**Expected behaviour**
- Intent: `check_rent_status`
- Complexity: 1
- Execution mode: DIRECT_LOOKUP
- Response language: sw
- Response contains: Swahili property vocabulary (wapangaji, pango, etc.)

---

### TC-INTENT-007: Bulk reminder — EN

**Added:** 2026-03-16
**Source:** manual-test
**Status:** ACTIVE
**Priority:** P1

**Input**
- Message: `remind all unpaid tenants`
- Role: AGENT
- Language: en

**Expected behaviour**
- Intent: `send_bulk_reminder`
- Complexity: 2
- Execution mode: LIGHT_COMPOSE

---

### TC-INTENT-008: McKinsey report — must be high complexity

**Added:** 2026-03-16
**Source:** manual-test
**Status:** ACTIVE
**Priority:** P1

**Input**
- Message: `generate monthly report for Bahari Ridge`
- Role: AGENT
- Language: en

**Expected behaviour**
- Intent: `generate_mckinsey_report`
- Complexity: 5
- Execution mode: INTELLIGENCE
- Model called: gemini (big model for analysis)

**Must NOT happen**
- Complexity < 4
- Routed to Groq only

---

### TC-INTENT-009: Question mark — show menu not agent pipeline

**Added:** 2026-03-16
**Source:** production-log
**Status:** ACTIVE
**Priority:** P1

**Input**
- Message: `?`
- Role: COMPANY_STAFF
- Language: en
- Context: none

**Expected behaviour**
- Intent: `show_menu`
- Execution mode: DIRECT_LOOKUP
- Response: role-appropriate action menu
- Model called: none

**Must NOT happen**
- Routed to agent pipeline with 10 generic tools
- 1726 tokens consumed (was the bug)
- Groq 400 error triggered

**Notes**
Single character messages (?, !, 🙏, hi) should show
the guided menu, never the full agent pipeline.

---

### TC-INTENT-010: List companies — COMPANY_STAFF role

**Added:** 2026-03-16
**Source:** production-log
**Status:** ACTIVE
**Priority:** P0

**Input**
- Message: `list companies`
- Role: COMPANY_STAFF
- Language: en
- Context: companyId=6ab64d38-7c1b-474d-b540-fa8e00bef351

**Expected behaviour**
- Intent: `list_companies`
- Complexity: 1
- Tools loaded: `[list_companies]` — at least 1 tool
- Response contains: company names

**Must NOT happen**
- 0 tools loaded (was the bug: 0/56 for STAFF)
- "No companies found" when companies exist
- Response fabricated without tool call

**Notes**
COMPANY_STAFF was missing from INTENT_TOOL_MAP for list_companies.
Must be fixed before any staff user can use the system.
