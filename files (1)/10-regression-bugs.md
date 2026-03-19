# Category 03: Payment Detection
## Golden test cases for record_payment intent

---

### TC-PAY-001: nimetuma — core Swahili signal

**Added:** 2026-03-16
**Source:** production-log
**Status:** ACTIVE
**Priority:** P0

**Input**
- Message: `nimetuma`
- Role: TENANT
- Language: sw

**Expected behaviour**
- Intent: `record_payment`
- Complexity: 2
- Response: ask for M-Pesa confirmation code

**Must NOT happen**
- Classified as general_query
- Classified as generate_basic_report (was a bug)

---

### TC-PAY-002: Payment variants — all must detect

**Added:** 2026-03-16
**Source:** manual-test
**Status:** ACTIVE
**Priority:** P1

**Input variants — all must classify as record_payment**
- `nimetuma pesa`
- `nimepay`
- `nimelipa`
- `pesa imeingia boss`
- `nimefanya malipo`
- `I have paid the rent`
- `transferred already`
- `sent the money`
- `malipo yamefanyika`
- `boss nimetuma five k jana`

**Expected behaviour**
- Intent: `record_payment` for ALL variants
- Language: sw for Swahili variants, en for English

---

### TC-PAY-003: NOT payment — interested in company

**Added:** 2026-03-16
**Source:** production-log
**Status:** ACTIVE
**Priority:** P0

**Input**
- Message: `I'm interested in alphask`
- Role: SUPER_ADMIN
- Context: previousIntent=list_companies

**Expected behaviour**
- Intent: `select_company`
- isPayment: false

**Must NOT happen**
- M-Pesa code "INTERESTED" extracted
- Payment recording triggered
- Response: "I see M-Pesa code INTERESTED..."

**Notes**
R005 — the exact bug observed in production.
Payment skill must validate: no payment signals = reject.

---

### TC-PAY-004: Payment skill input validation

**Added:** 2026-03-16
**Source:** bug-report
**Status:** ACTIVE
**Priority:** P0

**Validation rule**
The record_payment skill must reject execution when the
incoming message contains NONE of:
- An M-Pesa code pattern: `[A-Z0-9]{10}`
- A payment verb: nimetuma|nimepay|nimelipa|transferred|paid|sent
- A numeric amount: `\d{3,}`

**Test inputs that must be REJECTED by the skill**
- `I'm interested in alphask`
- `show me the report`
- `which units are vacant`
- `hello good morning`
- `1`
- `?`

---

# Category 04: List Navigation
## Golden test cases for guided list interactions

---

### TC-LIST-001: List companies — correct format

**Added:** 2026-03-16
**Source:** production-log
**Status:** ACTIVE
**Priority:** P1

**Input**
- Message: `List companies`
- Role: SUPER_ADMIN
- Language: en

**Expected behaviour**
- Response format: numbered list, names only
- Response contains: "Which company would you like to explore"
- Response excludes: UUIDs, raw IDs, "Returned: 6"

**Observed correct output (locked)**
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

**Observed wrong output (for reference)**
```
WRONG: Here are the companies: alphask (ID: d06b99a6-32a3-43b4-917a-d5a25c864337),
Ochieng Management No. 5 (ID: 6ab64d38...) [all on one line with UUIDs]
```

---

### TC-LIST-002: Numeric selection from list

**Added:** 2026-03-16
**Source:** production-log
**Status:** ACTIVE
**Priority:** P0

**Input**
- Message: `2`
- Role: SUPER_ADMIN
- Context: activeList=companies, page=1, items=[alphask, Ochieng Mgmt No.5, ...]

**Expected behaviour**
- Selects item at index 2: `Ochieng Management No. 5`
- Switches workspace to that company
- Response: company context menu with available actions

**Must NOT happen**
- Routed to classifier (must use quick action router)
- Returns "No companies found"
- Treated as payment notification

---

### TC-LIST-003: List too large — pagination offered proactively

**Added:** 2026-03-16
**Source:** manual-test
**Status:** ACTIVE
**Priority:** P1

**Input**
- Scenario: list_companies returns 25 results
- Page size: 8

**Expected behaviour**
- Shows first 8 items
- Response contains: "more" navigation hint
- Response contains: search hint ("type part of a name")
- System suggests navigation — user does not need to ask

**Observed correct format**
```
25 companies found. Showing 8:

1. Company A
2. Company B
[...8 items...]

Reply with a number to select, or:
• Type _more_ for next page
• Or type part of a name to search, e.g. _Ochieng_
```

---

### TC-LIST-004: Search within list

**Added:** 2026-03-16
**Source:** manual-test
**Status:** ACTIVE
**Priority:** P1

**Input**
- Message: `Ochieng`
- Context: activeList=companies (25 items)

**Expected behaviour**
- Filters list to items containing "Ochieng"
- Returns filtered numbered list
- Maintains list session state

---

# Category 05: Greeting Menus
## Golden test cases for role-based guided menus

---

### TC-GREET-001: Hello — SUPER_ADMIN menu

**Added:** 2026-03-16
**Source:** production-log
**Status:** ACTIVE
**Priority:** P1

**Input**
- Message: `Hello`
- Role: SUPER_ADMIN
- Language: en

**Expected behaviour**
- Response: greeting with numbered action menu
- Menu options include: List all companies, Switch company,
  Generate platform report, View system health
- Response excludes: UUIDs, technical jargon
- Model called: none (pure template)
- Max response time: 500ms

**Observed correct output (locked)**
```
👋 Welcome back, there.
Platform overview — what would you like to do?

1. List all companies
2. Switch active company
3. Generate platform report
4. View system health

Or type your question directly.
```

**Notes**
"Welcome back, there." — name was not resolved. Should be
"Welcome back, [Name]." — minor bug to fix but not P0.

---

### TC-GREET-002: Hello — AGENT menu with context

**Added:** 2026-03-16
**Source:** manual-test
**Status:** ACTIVE
**Priority:** P1

**Input**
- Message: `Hello`
- Role: AGENT
- Context: unpaidCount=6, propertyName=Bahari Ridge
- Language: en

**Expected behaviour**
- Response contains: unpaid count prominently
- Menu options: check unpaid, send reminders, generate report, log maintenance, vacancies
- Response: actionable, not generic

**Observed correct format**
```
👋 Good morning, James.
⚠ 6 unpaid tenants this month.

1. Check unpaid (6)
2. Send rent reminders
3. Generate landlord report
4. Log maintenance issue
5. Check vacancies

Or type your question directly.
```

---

### TC-GREET-003: /reset command clears session

**Added:** 2026-03-16
**Source:** production-log
**Status:** ACTIVE
**Priority:** P1

**Input**
- Message: `/reset`
- Role: SUPER_ADMIN

**Expected behaviour**
- Chat history cleared
- Active workflows cancelled
- List session state cleared
- Confirmation message sent
- Response: clean state confirmation

**Observed log entry**
```
[AiService] WhatsApp user 254782730463 requested a chat reset.
```

---

# Category 06: Tool Manifest
## Golden test cases for dynamic tool loading

---

### TC-TOOLS-001: list_companies loads exactly 1 tool for SUPER_ADMIN

**Added:** 2026-03-16
**Source:** production-log
**Status:** ACTIVE
**Priority:** P0

**Input**
- Intent: list_companies
- Role: SUPER_ADMIN

**Expected behaviour**
- Tools loaded: 1 (list_companies only)
- Log shows: `[ToolManifest] list_companies: 1/56 tools loaded`

**Must NOT happen**
- 51 or 56 tools loaded
- 0 tools loaded

**Observed correct log**
```
[ToolManifest] Groq list_companies: 1/56 tools loaded for SUPER_ADMIN
```

---

### TC-TOOLS-002: list_companies loads tool for COMPANY_STAFF

**Added:** 2026-03-16
**Source:** production-log (bug)
**Status:** ACTIVE
**Priority:** P0

**Input**
- Intent: list_companies
- Role: COMPANY_STAFF

**Expected behaviour**
- Tools loaded: >= 1

**Must NOT happen**
- 0 tools loaded (was the bug: `0/56 tools loaded for STAFF`)
- "No companies found" response

**Observed wrong log (the bug)**
```
[ToolManifest] Groq list_companies: 0/56 tools loaded for STAFF (Context: none)
```

---

### TC-TOOLS-003: TENANT never receives agent write tools

**Added:** 2026-03-16
**Source:** manual-test
**Status:** ACTIVE
**Priority:** P0

**Input**
- Any intent
- Role: TENANT

**Expected behaviour**
- Tools loaded: never includes send_bulk_reminder, delete_tenant,
  change_mpesa_destination, export_tenant_database,
  create_property, delete_property

**Notes**
Tool isolation is a security boundary.
A compromised tenant session must not be able to
invoke destructive or financial write operations.

---

### TC-TOOLS-004: Unknown intent falls back to safe set

**Added:** 2026-03-16
**Source:** production-log
**Status:** ACTIVE
**Priority:** P1

**Input**
- Intent: unknown
- Role: AGENT
- Message: `?`

**Expected behaviour**
- Tools loaded: <= 10 (safe default set)
- Must NOT load all 56 tools

**Observed wrong log (what happened with "?" message)**
```
[ToolManifest] Groq unknown: 10/56 tools loaded for STAFF
```
10 tools is acceptable. 56 would not be.

---

# Category 07: Response Formatting
## Golden test cases for output shape and quality

---

### TC-FORMAT-001: Company list — no UUIDs in user-facing output

**Added:** 2026-03-16
**Source:** production-log (bug)
**Status:** ACTIVE
**Priority:** P1

**Input**
- Scenario: list_companies returns 6 results

**Expected behaviour**
- Response: numbered list, names only
- Response excludes: UUID patterns `[a-f0-9]{8}-[a-f0-9]{4}-...`
- Response excludes: "Returned: 6"

**Observed wrong output**
```
WRONG: Here are the companies: alphask (ID: d06b99a6-32a3-43b4-917a-d5a25c864337),
Ochieng Management No. 5 (ID: 6ab64d38-7c1b-474d-b540-fa8e00bef351)...
```

---

### TC-FORMAT-002: Degradation notice only on total failure

**Added:** 2026-03-16
**Source:** production-log (bug)
**Status:** ACTIVE
**Priority:** P1

**Input**
- Scenario: Groq fails, Gemini fallback succeeds

**Expected behaviour**
- User receives: answer via Gemini
- User does NOT receive: degradation notice
- Degradation notice only fires when ALL models fail

**Observed wrong behaviour**
User received "Aedra is operating in fallback mode" even
though Gemini successfully answered the query.

---

### TC-FORMAT-003: No ghost deliveries

**Added:** 2026-03-16
**Source:** production-log (bug)
**Status:** ACTIVE
**Priority:** P1

**Input**
- Scenario: Same WhatsApp messageId received twice (Meta retry)

**Expected behaviour**
- Second webhook delivery: acknowledged and dropped
- User receives: exactly ONE response
- Redis idempotency key checked before processing

**Observed wrong behaviour**
```
[14:41] Aedra: No companies found
[14:46] Aedra: No companies found  ← ghost delivery 5 min later
```

---

# Category 08: Swahili / Bilingual
## Golden test cases for language correctness

---

### TC-SW-001: Swahili input gets Swahili output

**Added:** 2026-03-16
**Source:** manual-test
**Status:** ACTIVE
**Priority:** P1

**Input**
- Message: `hawajapaya nani mwezi huu`
- Role: AGENT
- Language: sw

**Expected behaviour**
- Response language: sw
- Response contains Swahili property vocabulary:
  wapangaji, pango, kitengo, mwezi, malipo
- Response does NOT contain: "Dear tenant", "your rent is due"
  (English patterns = bad translation signal)

---

### TC-SW-002: English input gets English output

**Added:** 2026-03-16
**Source:** manual-test
**Status:** ACTIVE
**Priority:** P1

**Input**
- Message: `who has not paid this month`
- Role: AGENT
- Language: en

**Expected behaviour**
- Response language: en
- Response does NOT contain: habari, asante, tafadhali

---

### TC-SW-003: Sheng/mixed treated as Swahili

**Added:** 2026-03-16
**Source:** manual-test
**Status:** ACTIVE
**Priority:** P1

**Input**
- Message: `boss nimetuma five k jana`
- Role: TENANT
- Language: mixed (SW+EN)

**Expected behaviour**
- Language detected: sw
- Intent: record_payment
- Response language: sw

---

### TC-SW-004: nimetuma → record_payment in any context

**Added:** 2026-03-16
**Source:** production-log
**Status:** ACTIVE
**Priority:** P0

**Input variants**
- `nimetuma`
- `nimepay`
- `nimetuma pesa`
- `boss nimetuma`
- `pesa imeingia`

**Expected behaviour**
- All variants: intent=record_payment
- Language: sw

---

# Category 09: Voice Notes
## Golden test cases for audio input handling

---

### TC-VOICE-001: Voice note transcribed before classification

**Added:** 2026-03-16
**Source:** production-log
**Status:** ACTIVE
**Priority:** P1

**Input**
- Message type: audio/ogg
- Content: voice note

**Expected behaviour**
- Audio transcribed BEFORE intent classification
- Classifier receives: text transcript (not audio)
- Intent classified from transcript text
- Classification: NOT unknown (unless transcript is unintelligible)

**Observed wrong behaviour**
```
Classification: intent=unknown, complexity=1
```
because classifier received audio before transcription.

---

### TC-VOICE-002: Unintelligible audio — polite retry

**Added:** 2026-03-16
**Source:** manual-test
**Status:** ACTIVE
**Priority:** P1

**Input**
- Message type: audio/ogg
- Content: background noise, unintelligible

**Expected behaviour**
- Response EN: "Sorry, I could not understand the voice note.
  Please try again or type your message."
- Response SW: "Samahani, sikuweza kusikia vizuri.
  Tafadhali rudia au andika ujumbe wako."
- No error thrown, no crash

---

### TC-VOICE-003: Gemini 429 on audio — fallback to Whisper

**Added:** 2026-03-16
**Source:** production-log
**Status:** ACTIVE
**Priority:** P1

**Input**
- Message type: audio/ogg
- Gemini: 429 rate limited

**Expected behaviour**
- Falls back to Groq Whisper transcription
- User still receives response
- No error shown to user

**Observed log**
```
ERROR [AiService] [HealthCheck] AI Model verification failed:
429 Too Many Requests Resource exhausted.
```
System handled it but Whisper fallback not yet implemented.

---

# Category 10: Regression Bugs
## Test cases built from real bugs — 100% pass rate required

---

### TC-REG-001: list_companies complexity 3 bug

**Added:** 2026-03-16
**Source:** production-log (bug at 10:36)
**Status:** ACTIVE
**Priority:** P0

**Bug observed**
```
Classification: intent=generate_basic_report, complexity=3, model=Tier 2
Total chat request: 71 seconds
```

**Input**
- Message: `List out companies for me`
- Role: SUPER_ADMIN

**Must be**
- complexity: 1
- mode: DIRECT_LOOKUP
- response time: < 3000ms

**Must NOT be**
- complexity: 3
- intent: generate_basic_report

---

### TC-REG-002: COMPANY_STAFF tool manifest 0 tools bug

**Added:** 2026-03-16
**Source:** production-log (bug)
**Status:** ACTIVE
**Priority:** P0

**Bug observed**
```
[ToolManifest] Groq list_companies: 0/56 tools loaded for STAFF
```
Result: "No companies found" when companies existed.

**Input**
- Intent: list_companies
- Role: COMPANY_STAFF

**Must be**
- Tools loaded: >= 1

---

### TC-REG-003: "Interested in X" triggers payment bug

**Added:** 2026-03-16
**Source:** production-log (bug)
**Status:** ACTIVE
**Priority:** P0

**Bug observed**
```
User: "I'm interested in alphask"
Aedra: "I see M-Pesa code INTERESTED, but I haven't received
the confirmation from M-Pesa yet."
```

**Input**
- Message: `I'm interested in alphask`
- Context: previousIntent=list_companies

**Must be**
- Intent: select_company
- No M-Pesa code extraction attempted

---

### TC-REG-004: Ghost delivery bug

**Added:** 2026-03-16
**Source:** production-log (bug)
**Status:** ACTIVE
**Priority:** P1

**Bug observed**
Same response delivered twice — 5 minutes apart.
Caused by Meta webhook retry + no idempotency check.

**Validation**
- Same messageId received twice → second ignored
- User receives exactly 1 response per message

---

### TC-REG-005: Groq tool loop 400 — empty tool result

**Added:** 2026-03-16
**Source:** production-log (bug)
**Status:** ACTIVE
**Priority:** P0

**Bug observed**
```
ERROR: 'messages.5' : for 'role:tool' the following must be
satisfied[('messages.5.content' : property 'content' is missing)]
```

**Root cause**
Tool returned null/empty result. Pipeline appended
role:tool message with null content. Groq rejected next call.

**Validation**
- All tool results sanitised before appending to history
- null/empty results replaced with: `{"status":"no_result","data":null}`
- Groq never receives a role:tool message with missing content

---

### TC-REG-006: Degradation notice on working fallback

**Added:** 2026-03-16
**Source:** production-log (bug)
**Status:** ACTIVE
**Priority:** P1

**Bug observed**
Groq failed → Gemini succeeded → user received
"Aedra is operating in fallback mode" unnecessarily.

**Validation**
- Degradation notice only fires when ALL models fail
- If any model succeeds → user receives answer, no notice

---

### TC-REG-007: Double model initialization on every request

**Added:** 2026-03-16
**Source:** production-log (bug)
**Status:** ACTIVE
**Priority:** P1

**Bug observed**
```
WARN [AiService] AI models not ready. Awaiting initialization...
ERROR [AiService] CRITICAL: AI models still undefined after awaiting modelsReady.
[AiTools] Initializing models with 56 tools total.  ← fires twice
```

**Validation**
- Models initialized once at startup
- Health check fires max once per request when needed
- No CRITICAL error on normal requests

---

### TC-REG-008: Voice note classified before transcription

**Added:** 2026-03-16
**Source:** production-log (bug)
**Status:** ACTIVE
**Priority:** P1

**Bug observed**
```
Classification: intent=unknown, complexity=1
[AiService] Processing attachment: audio/ogg
```
Classifier ran on empty text before audio was transcribed.

**Validation**
- Audio messages: transcription happens BEFORE classification
- Classifier always receives text, never raw audio type
- intent=unknown should not appear for audio with clear speech

---

# Category 11: Edge Cases
## Unusual but valid inputs the system must handle gracefully

---

### TC-EDGE-001: Single character message — not a number

**Added:** 2026-03-16
**Source:** production-log
**Status:** ACTIVE
**Priority:** P1

**Input**
- Message: `?`
- Role: COMPANY_STAFF

**Expected behaviour**
- Shows role-appropriate menu
- Does NOT route to full agent pipeline
- Does NOT consume 1726 tokens

---

### TC-EDGE-002: Empty message after audio

**Added:** 2026-03-16
**Source:** manual-test
**Status:** ACTIVE
**Priority:** P1

**Input**
- Message type: audio
- Audio content: complete silence or < 1 second

**Expected behaviour**
- Graceful error response
- No crash, no unhandled exception
- Polite retry message

---

### TC-EDGE-003: Message sent at month boundary

**Added:** 2026-03-16
**Source:** manual-test
**Status:** ACTIVE
**Priority:** P1

**Input**
- Message: `who hasn't paid this month`
- Role: AGENT
- Timestamp: 2026-03-31T23:58:00Z (2 minutes before April)

**Expected behaviour**
- "this month" = March 2026
- Billing cycle locked to March
- NOT showing April data (everyone unpaid)

---

### TC-EDGE-004: Number reply with no active list

**Added:** 2026-03-16
**Source:** manual-test
**Status:** ACTIVE
**Priority:** P1

**Input**
- Message: `3`
- Role: AGENT
- Context: no active list session

**Expected behaviour**
- System does not crash
- Response: shows role-appropriate menu
  OR asks what the user is responding to

**Must NOT happen**
- Array index out of bounds error
- Silent failure

---

### TC-EDGE-005: Duplicate webhook delivery

**Added:** 2026-03-16
**Source:** production-log (bug)
**Status:** ACTIVE
**Priority:** P1

**Input**
- Same WhatsApp messageId received twice within 5 minutes

**Expected behaviour**
- Second delivery silently dropped
- Redis idempotency key checked
- User receives exactly 1 response

---

### TC-EDGE-006: Unknown role — not in system

**Added:** 2026-03-16
**Source:** manual-test
**Status:** ACTIVE
**Priority:** P1

**Input**
- Phone number not in database
- Message: `hello`

**Expected behaviour**
- Routes to onboarding flow
- Does NOT crash
- Does NOT expose system internals

---

### TC-EDGE-007: Very long message (> 1000 characters)

**Added:** 2026-03-16
**Source:** manual-test
**Status:** ACTIVE
**Priority:** P1

**Input**
- Message: 1200 character text block
- Role: AGENT

**Expected behaviour**
- Scanned for injection patterns before processing
- Truncated to safe length before classifier
- No prompt injection via long message

---

### TC-EDGE-008: /reset mid-workflow

**Added:** 2026-03-16
**Source:** production-log
**Status:** ACTIVE
**Priority:** P1

**Input**
- Message: `/reset`
- Context: active workflow in progress

**Expected behaviour**
- Workflow cancelled cleanly
- Staging store purged
- List session cleared
- Chat history cleared
- Confirmation sent to user

**Observed log**
```
[AiService] WhatsApp user 254782730463 requested a chat reset.
```

---

### TC-EDGE-009: Swahili voice note

**Added:** 2026-03-16
**Source:** manual-test
**Status:** ACTIVE
**Priority:** P1

**Input**
- Message type: audio
- Content: "nimetuma pesa" spoken in Swahili

**Expected behaviour**
- Transcript: "nimetuma pesa"
- Language detected: sw
- Intent: record_payment
- Response: Swahili payment confirmation request
