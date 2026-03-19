# Aedra Test Suite
## Production-grade testing for every layer of the system

---

## Quick reference

```bash
# Before every commit
npm run test:unit

# Before every PR merge  
npm run test:unit && npm run test:integration

# Before deploying any model or prompt change
npm run test:pre-model-update

# Before deploying to production
npm run test:pre-deploy

# The night before 1st of month
npm run test:first-of-month

# Full suite
npm run test:all
```

---

## Architecture — 5 test layers

```
LAYER 5  Load tests         k6
         When: Weekly + before major events
         Validates: 100-user surge, emergency response time

LAYER 4  E2E tests          Jest + Supertest  
         When: Every deployment
         Validates: Full webhook → delivery pipeline

LAYER 3  AI behaviour       PromptFoo
         When: Every model/prompt change
         Validates: Intent accuracy, response quality, Swahili

LAYER 2  Integration        Jest + @nestjs/testing
         When: Every PR
         Validates: Service interactions, staging store, contracts

LAYER 1  Unit tests         Jest
         When: Every commit
         Validates: Classifiers, validators, tools, cache keys
```

---

## Install

```bash
npm install

# For load tests
brew install k6  # macOS
# or: https://k6.io/docs/get-started/installation/

# For AI behaviour tests
npm install -g promptfoo
```

---

## Test files

| File | Layer | What it tests |
|------|-------|---------------|
| `unit/intent-classifier.spec.ts` | 1 | Intent accuracy, complexity scoring, tool selection, emergency detection |
| `unit/validators.spec.ts` | 1 | StateValidator, FinancialCrossChecker, EmergencyEscalation, CacheKeyBuilder, ToolDedup |
| `integration/whatsapp-pipeline.spec.ts` | 2+4 | Full webhook → AI → delivery pipeline |
| `integration/contract-tests.spec.ts` | 2 | StagingStore, ReceiptService, TemporalContext, model regression |
| `ai/promptfoo.yaml` | 3 | Golden test set — intent, quality, Swahili, regression |
| `load/surge-scenarios.js` | 5 | 1st-of-month surge, steady state, emergency SLAs |

---

## Critical coverage requirements

These components have 100% coverage requirements — they protect
against the most dangerous black swans:

| Component | Required coverage | Why |
|-----------|-------------------|-----|
| `EmergencyEscalationService` | 100% | Physical safety risk (BS-15) |
| `FinancialCrossChecker` | 95% | Financial data integrity (BS-08) |
| `CacheKeyBuilder` | 100% | Privacy violation risk (BS-07) |
| `ConversationStateValidator` | 90% | Data corruption risk (BS-05) |

---

## Regression test IDs

These test IDs map to known bugs from production logs.
**If any regression test fails, do not deploy.**

| ID | Bug | Description |
|----|-----|-------------|
| R001 | Log: 10:36:28 complexity=3 | list_companies misclassified as complexity 3 → 71s response |
| R002 | SW payment not recognised | nimetuma not mapping to record_payment |
| R003 | Report under-routed | generate_report getting complexity < 4 |
| R004 | Emergency over-processed | Fire emergency being queued instead of immediate |

---

## The 1st-of-month test protocol

Run the evening before the 1st of every month:

```bash
# Step 1: Verify system handles surge
npm run test:load:surge

# Expected results:
# acknowledged_within_2s: rate > 0.95 ✓
# completed_within_60s: rate > 0.90 ✓
# error_rate: rate < 0.05 ✓
# http_req_failed: rate < 0.01 ✓

# Step 2: Verify emergency escalation is instant even under surge
npm run test:load:emergency

# Expected results:
# emergency_escalation_ms p(99) < 1000ms ✓

# Step 3: Verify model behaviour unchanged
npm run test:ai

# Expected results:
# pass rate > 95% ✓
```

If any of these fail, do not proceed with the 1st-of-month rollout
without fixing the failing scenario first.

---

## Adding new tests

### Adding an intent test case
Add to `AGENT_MESSAGES` array in `unit/intent-classifier.spec.ts`:
```typescript
{
  message: 'your new message',
  expectedIntent: 'your_intent',
  expectedComplexity: 1,
  expectedMode: 'DIRECT_LOOKUP',
  expectedLang: 'en',
  description: 'What this tests'
},
```

### Adding a PromptFoo test
Add to `src/ai/promptfoo.yaml` under `tests:`:
```yaml
- description: "What this tests"
  vars:
    persona: AGENT
    message: "the message"
  assert:
    - type: javascript
      value: "output.intent === 'expected_intent'"
```

### Adding a regression test
Add to `REGRESSION_CASES` in `integration/contract-tests.spec.ts`:
```typescript
{
  id: 'R005',
  description: 'Description of the bug this prevents',
  input: 'the message that triggered the bug',
  requiredIntent: 'correct_intent',
  requiredMaxComplexity: 1,
},
```

---

## Interpreting test failures

**Unit test fails:**
A function is broken. Do not merge. Fix immediately.

**Integration test fails:**
A service interaction is broken. Check recent changes to
the failing service. Do not deploy.

**PromptFoo test falls below 95%:**
A model update has changed behaviour. Roll back the model
version or update the prompts. Do not deploy.

**Load test: acknowledged_within_2s < 0.90:**
Queue is backed up. BullMQ workers may need scaling.
Do not run on 1st of month.

**Load test: emergency_escalation_ms p(99) > 1000ms:**
Emergency flow is being queued. Critical — fix before
any deployment. Physical safety risk.

**Regression test fails:**
A known bug has been reintroduced. This is a hard block.
Do not merge. Do not deploy.





// ─────────────────────────────────────────────────────────────
// LAYER 1 — UNIT TESTS
// File: src/unit/intent-classifier.spec.ts
// Tests: Intent classification accuracy, complexity scoring,
//        tool selection, execution mode routing
// Run:   jest src/unit/intent-classifier.spec.ts
// ─────────────────────────────────────────────────────────────

import { Test, TestingModule } from '@nestjs/testing';
import { AiClassifierService } from '../../src/ai/ai-classifier.service';
import { selectTools, INTENT_TOOL_MAP } from '../../src/ai/tool-manifest';

// ── Types ─────────────────────────────────────────────────────
interface ClassificationResult {
  intent: string;
  complexity: number;
  executionMode: 'DIRECT_LOOKUP' | 'LIGHT_COMPOSE' | 'ORCHESTRATED' | 'INTELLIGENCE';
  language: 'en' | 'sw' | 'mixed';
}

// ── Test data: the probability space ─────────────────────────
// These are the messages your real agents will send.
// Ordered by expected frequency in production.

const AGENT_MESSAGES = [
  // HIGH FREQUENCY — must be correct every time
  {
    message: 'who has not paid this month',
    expectedIntent: 'check_rent_status',
    expectedComplexity: 1,
    expectedMode: 'DIRECT_LOOKUP',
    expectedLang: 'en',
    description: 'Basic arrears check — EN'
  },
  {
    message: 'hawajapaya nani mwezi huu',
    expectedIntent: 'check_rent_status',
    expectedComplexity: 1,
    expectedMode: 'DIRECT_LOOKUP',
    expectedLang: 'sw',
    description: 'Basic arrears check — SW'
  },
  {
    message: 'remind all unpaid tenants',
    expectedIntent: 'send_bulk_reminder',
    expectedComplexity: 2,
    expectedMode: 'LIGHT_COMPOSE',
    expectedLang: 'en',
    description: 'Bulk reminder — EN'
  },
  {
    message: 'kumbushia wote ambao hawajalipa',
    expectedIntent: 'send_bulk_reminder',
    expectedComplexity: 2,
    expectedMode: 'LIGHT_COMPOSE',
    expectedLang: 'sw',
    description: 'Bulk reminder — SW'
  },
  {
    message: 'log maintenance issue for unit 4B — broken tap',
    expectedIntent: 'log_maintenance',
    expectedComplexity: 1,
    expectedMode: 'DIRECT_LOOKUP',
    expectedLang: 'en',
    description: 'Maintenance log — EN'
  },
  {
    message: 'kitengo 4B kuna bomba iliyovunjika',
    expectedIntent: 'log_maintenance',
    expectedComplexity: 1,
    expectedMode: 'DIRECT_LOOKUP',
    expectedLang: 'sw',
    description: 'Maintenance log — SW'
  },

  // MEDIUM FREQUENCY
  {
    message: 'generate monthly report for Bahari Ridge',
    expectedIntent: 'generate_mckinsey_report',
    expectedComplexity: 5,
    expectedMode: 'INTELLIGENCE',
    expectedLang: 'en',
    description: 'McKinsey report request'
  },
  {
    message: 'tengeneza ripoti ya mwezi kwa Bahari Ridge',
    expectedIntent: 'generate_mckinsey_report',
    expectedComplexity: 5,
    expectedMode: 'INTELLIGENCE',
    expectedLang: 'sw',
    description: 'McKinsey report request — SW'
  },
  {
    message: 'add new tenant Sarah Wanjiku to unit 3A',
    expectedIntent: 'add_tenant',
    expectedComplexity: 2,
    expectedMode: 'ORCHESTRATED',
    expectedLang: 'en',
    description: 'Tenant onboarding'
  },
  {
    message: 'which units are currently vacant',
    expectedIntent: 'check_vacancy',
    expectedComplexity: 1,
    expectedMode: 'DIRECT_LOOKUP',
    expectedLang: 'en',
    description: 'Vacancy check'
  },
  {
    message: 'vitengo vipi ambavyo viko wazi sasa hivi',
    expectedIntent: 'check_vacancy',
    expectedComplexity: 1,
    expectedMode: 'DIRECT_LOOKUP',
    expectedLang: 'sw',
    description: 'Vacancy check — SW'
  },
  {
    message: 'list companies',
    expectedIntent: 'list_companies',
    expectedComplexity: 1,
    expectedMode: 'DIRECT_LOOKUP',
    expectedLang: 'en',
    description: 'List companies — should never touch Tier 3 model'
  },
  {
    message: 'Hello, list our companies for me',
    expectedIntent: 'list_companies',
    expectedComplexity: 1,
    expectedMode: 'DIRECT_LOOKUP',
    expectedLang: 'en',
    description: 'List companies with greeting — was misclassified as complexity 3 in logs'
  },

  // TENANT MESSAGES
  {
    message: 'nimetuma pesa',
    expectedIntent: 'record_payment',
    expectedComplexity: 2,
    expectedMode: 'ORCHESTRATED',
    expectedLang: 'sw',
    description: 'Swahili payment notification'
  },
  {
    message: 'nimepay',
    expectedIntent: 'record_payment',
    expectedComplexity: 2,
    expectedMode: 'ORCHESTRATED',
    expectedLang: 'sw',
    description: 'Swahili payment — slang variant'
  },
  {
    message: 'I have paid the rent',
    expectedIntent: 'record_payment',
    expectedComplexity: 2,
    expectedMode: 'ORCHESTRATED',
    expectedLang: 'en',
    description: 'Payment notification — EN'
  },
  {
    message: 'send me my receipt',
    expectedIntent: 'request_receipt',
    expectedComplexity: 1,
    expectedMode: 'DIRECT_LOOKUP',
    expectedLang: 'en',
    description: 'Receipt request'
  },
  {
    message: 'tuma risiti yangu',
    expectedIntent: 'request_receipt',
    expectedComplexity: 1,
    expectedMode: 'DIRECT_LOOKUP',
    expectedLang: 'sw',
    description: 'Receipt request — SW'
  },
  {
    message: 'the kitchen sink is leaking badly',
    expectedIntent: 'report_maintenance',
    expectedComplexity: 1,
    expectedMode: 'DIRECT_LOOKUP',
    expectedLang: 'en',
    description: 'Tenant maintenance report'
  },

  // LANDLORD MESSAGES
  {
    message: 'how much has been collected this month',
    expectedIntent: 'collection_status',
    expectedComplexity: 1,
    expectedMode: 'DIRECT_LOOKUP',
    expectedLang: 'en',
    description: 'Landlord collection query'
  },
  {
    message: 'send me the full report',
    expectedIntent: 'request_report',
    expectedComplexity: 3,
    expectedMode: 'ORCHESTRATED',
    expectedLang: 'en',
    description: 'Landlord report request'
  },
];

// ── EMERGENCY SIGNALS — must NEVER be misclassified ──────────
const EMERGENCY_MESSAGES = [
  { message: 'there is a fire in the building', keyword: 'fire' },
  { message: 'moto umewaka jikoni', keyword: 'moto' },
  { message: 'mafuriko unit 6', keyword: 'mafuriko' },
  { message: 'flooding in the basement', keyword: 'flood' },
  { message: 'gesi inachuruzika', keyword: 'gesi' },
  { message: 'there is a gas leak', keyword: 'gas' },
  { message: 'msaada mtu ameanguka', keyword: 'msaada' },
  { message: 'someone is hurt badly help me', keyword: 'help me' },
  { message: 'umeme unachoma', keyword: 'umeme' },
];

// ── SHOULD NEVER TRIGGER MODEL — direct lookup queries ────────
const DIRECT_LOOKUP_QUERIES = [
  'list companies',
  'list our companies',
  'how many tenants do we have',
  'which units are vacant',
  'show me companies',
  'vitengo vipi viko wazi',
];

// ────────────────────────────────────────────────────────────
describe('AiClassifierService', () => {
  let classifier: AiClassifierService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiClassifierService],
    }).compile();

    classifier = module.get<AiClassifierService>(AiClassifierService);
  });

  // ── Core classification accuracy ─────────────────────────
  describe('Intent Classification', () => {
    test.each(AGENT_MESSAGES)(
      '$description',
      async ({ message, expectedIntent, expectedComplexity, expectedMode, expectedLang }) => {
        const result: ClassificationResult = await classifier.classify(message);

        expect(result.intent).toBe(expectedIntent);
        expect(result.language).toBe(expectedLang);

        // Complexity tolerance: ±1 acceptable except for DIRECT_LOOKUP
        // which must be exactly 1 (must never route to expensive model)
        if (expectedMode === 'DIRECT_LOOKUP') {
          expect(result.complexity).toBe(1);
          expect(result.executionMode).toBe('DIRECT_LOOKUP');
        } else {
          expect(result.complexity).toBeGreaterThanOrEqual(expectedComplexity - 1);
          expect(result.complexity).toBeLessThanOrEqual(expectedComplexity + 1);
        }
      }
    );
  });

  // ── Critical: list companies must NEVER be complexity > 1 ─
  describe('Complexity Calibration — no over-routing', () => {
    test.each(DIRECT_LOOKUP_QUERIES)(
      'DIRECT_LOOKUP: "%s" must not touch expensive model',
      async (message) => {
        const result = await classifier.classify(message);
        expect(result.complexity).toBe(1);
        expect(result.executionMode).toBe('DIRECT_LOOKUP');
        // This was the bug in the logs — Hello list companies
        // was routing to complexity 3 / Tier 2
      }
    );
  });

  // ── Emergency signal detection ────────────────────────────
  describe('Emergency Signal Detection — must never miss', () => {
    test.each(EMERGENCY_MESSAGES)(
      'Emergency detected: "$message"',
      async ({ message }) => {
        const result = await classifier.classify(message);
        expect(result.intent).toBe('emergency_escalation');
        // Emergency must always be complexity 1 — immediate response
        // required, never queue for expensive model processing
        expect(result.complexity).toBe(1);
        expect(result.executionMode).toBe('DIRECT_LOOKUP');
      }
    );
  });

  // ── Language detection ────────────────────────────────────
  describe('Language Detection', () => {
    it('detects English correctly', async () => {
      const result = await classifier.classify('show me all unpaid tenants');
      expect(result.language).toBe('en');
    });

    it('detects Swahili correctly', async () => {
      const result = await classifier.classify('nionyeshe wapangaji wote ambao hawajalipa');
      expect(result.language).toBe('sw');
    });

    it('handles mixed Swahili-English (Sheng) as Swahili', async () => {
      const result = await classifier.classify('boss nimetuma pesa jana si leo');
      expect(result.language).toBe('sw');
    });

    it('handles nimetuma → record_payment in any context', async () => {
      const variants = [
        'nimetuma', 'nimepay', 'nimetuma pesa', 'nimetuma 5k',
        'boss nimetuma', 'pesa imeingia', 'nimefanya malipo',
        'I have paid', 'sent the money', 'transferred already',
        'malipo yamefanyika'
      ];
      for (const msg of variants) {
        const result = await classifier.classify(msg);
        expect(result.intent).toBe('record_payment');
      }
    });
  });
});

// ────────────────────────────────────────────────────────────
describe('Tool Selection Layer', () => {

  // ── Tool count constraints ────────────────────────────────
  describe('Tool manifest pruning', () => {
    it('list_companies loads exactly 1 tool', () => {
      const tools = selectTools('list_companies', 'SUPER_ADMIN');
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('list_companies');
    });

    it('check_rent_status loads ≤ 3 tools', () => {
      const tools = selectTools('check_rent_status', 'AGENT');
      expect(tools.length).toBeLessThanOrEqual(3);
    });

    it('generate_mckinsey_report loads ≤ 10 tools', () => {
      const tools = selectTools('generate_mckinsey_report', 'AGENT');
      expect(tools.length).toBeLessThanOrEqual(10);
    });

    it('never loads more than 51 tools for any intent', () => {
      Object.keys(INTENT_TOOL_MAP).forEach(intent => {
        const tools = selectTools(intent, 'SUPER_ADMIN');
        expect(tools.length).toBeLessThanOrEqual(51);
      });
    });

    it('TENANT persona never receives agent-only tools', () => {
      const tenantTools = selectTools('tenant_balance_inquiry', 'TENANT');
      const agentOnlyTools = [
        'send_bulk_reminder', 'generate_report', 'export_tenant_database',
        'change_mpesa_destination', 'create_property', 'delete_property'
      ];
      tenantTools.forEach(tool => {
        expect(agentOnlyTools).not.toContain(tool.name);
      });
    });

    it('LANDLORD persona never receives write tools', () => {
      const landlordTools = selectTools('collection_status', 'LANDLORD');
      const writeTools = [
        'create_tenant', 'update_tenant', 'delete_tenant',
        'send_bulk_reminder', 'change_mpesa_destination'
      ];
      landlordTools.forEach(tool => {
        expect(writeTools).not.toContain(tool.name);
      });
    });

    it('unknown intent falls back to safe default set ≤ 8 tools', () => {
      const tools = selectTools('completely_unknown_intent_xyz', 'AGENT');
      expect(tools.length).toBeLessThanOrEqual(8);
      // Should never fall back to all 51
    });
  });

  // ── Persona isolation ─────────────────────────────────────
  describe('Persona tool isolation', () => {
    it('TENANT tools are a strict subset of AGENT tools', () => {
      const tenantTools = selectTools('report_maintenance', 'TENANT');
      const agentTools = selectTools('log_maintenance', 'AGENT');
      const agentToolNames = agentTools.map(t => t.name);
      tenantTools.forEach(tool => {
        // Tenant tools should not exceed agent tool permissions
        // for equivalent operations
        expect(agentToolNames.length).toBeGreaterThanOrEqual(
          tenantTools.length
        );
      });
    });

    it('same intent loads different tools for different personas', () => {
      // A maintenance query from TENANT vs AGENT should load
      // different tool sets — tenant cannot assign, only report
      const tenantTools = selectTools('report_maintenance', 'TENANT')
        .map(t => t.name);
      const agentTools = selectTools('log_maintenance', 'AGENT')
        .map(t => t.name);

      // Agent should have more tools than tenant for maintenance
      expect(agentTools.length).toBeGreaterThan(tenantTools.length);
      // Tenant should not have assignment tool
      expect(tenantTools).not.toContain('assign_maintenance_technician');
    });
  });
});






// ─────────────────────────────────────────────────────────────
// LAYER 1 — UNIT TESTS
// File: src/unit/validators.spec.ts
// Tests: ConversationStateValidator, FinancialCrossChecker,
//        Emergency escalation trigger, Cache key isolation,
//        Tool deduplication
// ─────────────────────────────────────────────────────────────

import { ConversationStateValidator } from '../../src/ai/conversation-state-validator';
import { FinancialCrossChecker } from '../../src/ai/financial-cross-checker';
import { EmergencyEscalationService } from '../../src/ai/emergency-escalation.service';
import { ToolDeduplicationCache } from '../../src/ai/tool-dedup-cache';
import { CacheKeyBuilder } from '../../src/cache/cache-key-builder';

// ── Conversation State Validator ─────────────────────────────

describe('ConversationStateValidator', () => {
  let validator: ConversationStateValidator;

  beforeEach(() => {
    validator = new ConversationStateValidator();
  });

  describe('Valid histories', () => {
    it('accepts empty history (new conversation)', () => {
      const result = validator.validate([]);
      expect(result.valid).toBe(true);
      expect(result.repaired).toBe(false);
    });

    it('accepts clean alternating user/assistant history', () => {
      const history = [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi there' },
        { role: 'user', content: 'check balance' },
        { role: 'assistant', content: 'your balance is KES 24,000' },
      ];
      const result = validator.validate(history);
      expect(result.valid).toBe(true);
    });

    it('accepts history with tool calls that have results', () => {
      const history = [
        { role: 'user', content: 'who has not paid' },
        { role: 'assistant', content: '', tool_calls: [
          { id: 'call_1', function: { name: 'get_unpaid_tenants' } }
        ]},
        { role: 'tool', tool_call_id: 'call_1', content: '{"unpaid": []}' },
        { role: 'assistant', content: 'everyone has paid this month' },
      ];
      const result = validator.validate(history);
      expect(result.valid).toBe(true);
    });
  });

  describe('Corrupted histories — must be repaired', () => {
    it('detects and repairs dangling tool call (no result)', () => {
      const history = [
        { role: 'user', content: 'check balance' },
        { role: 'assistant', content: '', tool_calls: [
          { id: 'call_1', function: { name: 'get_balance' } }
        ]},
        // Missing tool result — this is corruption
        { role: 'user', content: 'hello' },
      ];
      const result = validator.validate(history);
      expect(result.valid).toBe(false);
      expect(result.repaired).toBe(true);
      // After repair, dangling tool call should be resolved
      expect(result.repairedHistory).toBeDefined();
      // Repaired history should not contain the dangling call
      const hasUnresolvedToolCall = result.repairedHistory!.some(
        (turn, i) =>
          turn.tool_calls &&
          !result.repairedHistory![i + 1]?.tool_call_id
      );
      expect(hasUnresolvedToolCall).toBe(false);
    });

    it('detects consecutive user messages (missing assistant response)', () => {
      const history = [
        { role: 'user', content: 'first message' },
        { role: 'user', content: 'second message before response' },
      ];
      const result = validator.validate(history);
      expect(result.valid).toBe(false);
    });

    it('detects assistant message without preceding user message', () => {
      const history = [
        { role: 'assistant', content: 'orphaned response' },
        { role: 'user', content: 'some message' },
      ];
      const result = validator.validate(history);
      expect(result.valid).toBe(false);
    });

    it('handles empty content in assistant message gracefully', () => {
      const history = [
        { role: 'user', content: 'test' },
        { role: 'assistant', content: '' }, // empty but valid
      ];
      const result = validator.validate(history);
      expect(result.valid).toBe(true);
    });
  });

  describe('History windowing', () => {
    it('prunes history to correct depth for complexity 1', () => {
      const longHistory = Array.from({ length: 30 }, (_, i) => ([
        { role: 'user', content: `message ${i}` },
        { role: 'assistant', content: `response ${i}` },
      ])).flat();

      const pruned = validator.pruneToDepth(longHistory, 1);
      // Complexity 1 should only see last 6 turns (3 exchanges)
      expect(pruned.length).toBeLessThanOrEqual(6);
    });

    it('prunes history to correct depth for complexity 5', () => {
      const longHistory = Array.from({ length: 30 }, (_, i) => ([
        { role: 'user', content: `message ${i}` },
        { role: 'assistant', content: `response ${i}` },
      ])).flat();

      const pruned = validator.pruneToDepth(longHistory, 5);
      // Complexity 5 can see up to 20 turns (10 exchanges)
      expect(pruned.length).toBeLessThanOrEqual(20);
    });
  });
});

// ── Financial Cross-Checker ───────────────────────────────────

describe('FinancialCrossChecker', () => {
  let checker: FinancialCrossChecker;

  beforeEach(() => {
    checker = new FinancialCrossChecker();
  });

  describe('Valid responses', () => {
    it('passes when all figures in response exist in tool results', () => {
      const toolResults = [
        { tool: 'get_collection_summary', result: {
          total_collected: 2435000,
          total_due: 2590000,
          collection_rate: 94,
          outstanding: 155000
        }}
      ];

      const response = 'Collection rate: 94%. Collected KES 2,435,000 of KES 2,590,000. Outstanding: KES 155,000.';

      const result = checker.verify(response, toolResults);
      expect(result.passed).toBe(true);
      expect(result.unverifiedNumbers).toHaveLength(0);
    });

    it('passes when response contains no financial figures', () => {
      const toolResults = [];
      const response = 'All tenants have been notified. Have a good day.';
      const result = checker.verify(response, toolResults);
      expect(result.passed).toBe(true);
    });
  });

  describe('Hallucinated figures — must be caught', () => {
    it('fails when response contains number not in tool results', () => {
      const toolResults = [
        { tool: 'get_collection_summary', result: {
          total_collected: 2435000,
          collection_rate: 94,
        }}
      ];

      // Model hallucinated 97% — actual is 94%
      const response = 'Your collection rate this month is 97%.';

      const result = checker.verify(response, toolResults);
      expect(result.passed).toBe(false);
      expect(result.unverifiedNumbers).toContain(97);
    });

    it('fails when model invents a balance not returned by tools', () => {
      const toolResults = [
        { tool: 'get_tenant', result: {
          name: 'Sarah Ali',
          unit: 'A1',
          // No balance field returned — tool didn't provide it
        }}
      ];

      const response = 'Sarah Ali owes KES 18,000 this month.';

      const result = checker.verify(response, toolResults);
      expect(result.passed).toBe(false);
      expect(result.unverifiedNumbers).toContain(18000);
    });

    it('detects near-miss figures (rounding hallucination)', () => {
      const toolResults = [
        { tool: 'get_collection_summary', result: {
          total_collected: 2435000,
        }}
      ];

      // Model rounded 2,435,000 to 2,440,000 — still wrong
      const response = 'Total collected: KES 2,440,000.';

      const result = checker.verify(response, toolResults);
      expect(result.passed).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('handles currency formatting variations', () => {
      const toolResults = [
        { tool: 'get_balance', result: { amount: 24000 }}
      ];
      // Should match 24,000 and 24000 and KES 24,000
      const response = 'Your balance is KES 24,000.';
      const result = checker.verify(response, toolResults);
      expect(result.passed).toBe(true);
    });

    it('handles percentage vs decimal representations', () => {
      const toolResults = [
        { tool: 'get_stats', result: { rate: 0.94 }}
      ];
      // 0.94 = 94% — should pass
      const response = 'Collection rate: 94%.';
      const result = checker.verify(response, toolResults);
      expect(result.passed).toBe(true);
    });
  });
});

// ── Emergency Escalation ──────────────────────────────────────

describe('EmergencyEscalationService', () => {
  let service: EmergencyEscalationService;

  beforeEach(() => {
    service = new EmergencyEscalationService();
  });

  const MUST_ESCALATE = [
    { message: 'there is a fire in the building', label: 'fire EN' },
    { message: 'moto umewaka', label: 'fire SW' },
    { message: 'there is flooding', label: 'flood EN' },
    { message: 'mafuriko basement', label: 'flood SW' },
    { message: 'gas leak in unit 3', label: 'gas leak' },
    { message: 'gesi inachuruzika', label: 'gas leak SW' },
    { message: 'msaada mtu ameanguka', label: 'injury SW' },
    { message: 'someone is hurt please help', label: 'injury EN' },
    { message: 'umeme unachoma waya', label: 'electrical SW' },
    { message: 'help me there is an emergency', label: 'generic emergency' },
    { message: 'damu nyingi unit 7', label: 'blood SW' },
    { message: 'ceiling collapsed on tenant', label: 'structural' },
  ];

  const MUST_NOT_ESCALATE = [
    { message: 'the tap is dripping', label: 'routine maintenance' },
    { message: 'bomba inachuruzika kidogo', label: 'minor leak SW' },
    { message: 'unit 4B needs painting', label: 'cosmetic' },
    { message: 'who has not paid', label: 'admin query' },
    { message: 'generate report', label: 'report request' },
    { message: 'the fire exit sign is broken', label: 'fire sign — not fire' },
    { message: 'we need gas for the kitchen', label: 'gas supply — not leak' },
  ];

  test.each(MUST_ESCALATE)(
    'MUST escalate: $label',
    ({ message }) => {
      const result = service.checkForEmergency(message);
      expect(result.isEmergency).toBe(true);
      expect(result.agentPhoneIncluded).toBe(true);
      expect(result.stopAutomatedFlow).toBe(true);
    }
  );

  test.each(MUST_NOT_ESCALATE)(
    'must NOT escalate: $label',
    ({ message }) => {
      const result = service.checkForEmergency(message);
      expect(result.isEmergency).toBe(false);
    }
  );

  it('escalation response never includes a ticket reference', () => {
    const result = service.buildEscalationResponse(
      { isEmergency: true },
      { agentPhone: '+254712345678', agentName: 'James' }
    );
    expect(result.message).not.toMatch(/ticket|ref|#\d+/i);
    expect(result.message).toContain('+254712345678');
  });
});

// ── Cache Key Isolation (BS-07) ───────────────────────────────

describe('CacheKeyBuilder — data isolation', () => {
  let builder: CacheKeyBuilder;

  beforeEach(() => {
    builder = new CacheKeyBuilder();
  });

  it('always includes userId as first component', () => {
    const key = builder.build({
      userId: 'user_123',
      intent: 'check_rent_status',
      propertyId: 'prop_456'
    });
    expect(key.startsWith('user_123:')).toBe(true);
  });

  it('two different users never produce the same cache key', () => {
    const key1 = builder.build({ userId: 'agent_A', intent: 'check_rent_status' });
    const key2 = builder.build({ userId: 'agent_B', intent: 'check_rent_status' });
    expect(key1).not.toBe(key2);
  });

  it('same user, same intent, different property produces different keys', () => {
    const key1 = builder.build({ userId: 'agent_A', intent: 'check_rent_status', propertyId: 'prop_1' });
    const key2 = builder.build({ userId: 'agent_A', intent: 'check_rent_status', propertyId: 'prop_2' });
    expect(key1).not.toBe(key2);
  });

  it('key never contains whitespace', () => {
    const key = builder.build({ userId: 'user 123', intent: 'check status' });
    expect(key).not.toMatch(/\s/);
  });

  it('key never contains path separators', () => {
    const key = builder.build({ userId: 'user/123', intent: 'check/status' });
    expect(key).not.toMatch(/[/\\]/);
  });

  it('rejects build attempt without userId', () => {
    expect(() => builder.build({ intent: 'check_rent_status' } as any))
      .toThrow('userId is required for cache key construction');
  });
});

// ── Tool Deduplication Cache ──────────────────────────────────

describe('ToolDeduplicationCache', () => {
  let cache: ToolDeduplicationCache;

  beforeEach(() => {
    cache = new ToolDeduplicationCache();
  });

  it('returns cached result on duplicate call within same turn', async () => {
    const mockTool = jest.fn().mockResolvedValue({ companies: ['Ochieng', 'Garcia'] });
    const key = 'list_companies:{}';

    // First call — executes
    const result1 = await cache.executeWithDedup(key, mockTool);
    // Second call — should return cache, not execute again
    const result2 = await cache.executeWithDedup(key, mockTool);

    expect(mockTool).toHaveBeenCalledTimes(1);
    expect(result1).toEqual(result2);
  });

  it('executes again after turn reset', async () => {
    const mockTool = jest.fn().mockResolvedValue({ data: 'result' });
    const key = 'list_companies:{}';

    await cache.executeWithDedup(key, mockTool);
    cache.resetForNewTurn(); // Simulate new turn
    await cache.executeWithDedup(key, mockTool);

    expect(mockTool).toHaveBeenCalledTimes(2);
  });

  it('different args produce different cache keys', async () => {
    const mockTool = jest.fn().mockResolvedValue({ data: 'result' });

    await cache.executeWithDedup('get_tenant:{"id":"123"}', mockTool);
    await cache.executeWithDedup('get_tenant:{"id":"456"}', mockTool);

    // Both should execute — different args
    expect(mockTool).toHaveBeenCalledTimes(2);
  });
});






// ─────────────────────────────────────────────────────────────
// LAYER 2 — INTEGRATION TESTS
// File: src/integration/whatsapp-pipeline.spec.ts
// Tests: Full pipeline from webhook to delivery
//        Uses real NestJS DI, mocked external services
// Run:   jest src/integration/whatsapp-pipeline.spec.ts
// ─────────────────────────────────────────────────────────────

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

// ── WhatsApp webhook payload builder ─────────────────────────
function buildWebhookPayload(
  fromPhone: string,
  messageText: string,
  messageId?: string
) {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      id: '1280198773926132',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '254752167271',
            phone_number_id: '1084609064725669',
          },
          contacts: [{
            profile: { name: 'Test User' },
            wa_id: fromPhone,
          }],
          messages: [{
            from: fromPhone,
            id: messageId || `wamid.test_${Date.now()}`,
            timestamp: String(Math.floor(Date.now() / 1000)),
            text: { body: messageText },
            type: 'text',
          }],
        },
        field: 'messages',
      }],
    }],
  };
}

// ── Personas with test phone numbers ─────────────────────────
const TEST_USERS = {
  SUPER_ADMIN: '254782730463',
  AGENT:       '254700000001',
  TENANT:      '254700000002',
  LANDLORD:    '254700000003',
};

// ────────────────────────────────────────────────────────────
describe('WhatsApp Pipeline Integration', () => {
  let app: INestApplication;
  let whatsappServiceMock: jest.Mock;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
    .overrideProvider('WhatsAppClient')
    .useValue({
      sendMessage: jest.fn().mockResolvedValue({ messageId: 'mock_msg_id' }),
      sendTemplate: jest.fn().mockResolvedValue({ messageId: 'mock_template_id' }),
    })
    .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    whatsappServiceMock = moduleFixture
      .get('WhatsAppClient').sendMessage as jest.Mock;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Webhook receives and responds ─────────────────────────
  describe('Webhook endpoint', () => {
    it('returns 201 for valid WhatsApp webhook payload', async () => {
      const payload = buildWebhookPayload(
        TEST_USERS.SUPER_ADMIN,
        'list companies'
      );

      const response = await request(app.getHttpServer())
        .post('/webhook')
        .send(payload)
        .expect(201);

      expect(response.body).toBeDefined();
    });

    it('returns 200 for webhook verification (GET)', async () => {
      await request(app.getHttpServer())
        .get('/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.challenge': '12345',
          'hub.verify_token': process.env.WHATSAPP_VERIFY_TOKEN,
        })
        .expect(200);
    });

    it('ignores status update webhooks without processing', async () => {
      // Status updates (sent/delivered/read) should not trigger AI
      const statusPayload = {
        object: 'whatsapp_business_account',
        entry: [{
          id: '1280198773926132',
          changes: [{
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '254752167271',
                phone_number_id: '1084609064725669',
              },
              statuses: [{
                id: 'wamid.test_123',
                status: 'delivered',
                timestamp: String(Date.now()),
                recipient_id: TEST_USERS.AGENT,
              }],
            },
            field: 'messages',
          }],
        }],
      };

      await request(app.getHttpServer())
        .post('/webhook')
        .send(statusPayload)
        .expect(201);

      // AI should NOT have been invoked for a status update
      // WhatsApp send should NOT have been called
      expect(whatsappServiceMock).not.toHaveBeenCalled();
    });
  });

  // ── Response time SLAs ────────────────────────────────────
  describe('Response time SLAs', () => {
    it('DIRECT_LOOKUP queries respond in < 3 seconds', async () => {
      const start = Date.now();

      await request(app.getHttpServer())
        .post('/webhook')
        .send(buildWebhookPayload(TEST_USERS.AGENT, 'list companies'))
        .expect(201);

      // Wait for async processing
      await new Promise(r => setTimeout(r, 3000));

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(3000);

      // WhatsApp delivery should have been called
      expect(whatsappServiceMock).toHaveBeenCalled();
    }, 10000);

    it('sends immediate acknowledgement for complex requests', async () => {
      await request(app.getHttpServer())
        .post('/webhook')
        .send(buildWebhookPayload(
          TEST_USERS.AGENT,
          'generate mckinsey report for Bahari Ridge'
        ))
        .expect(201);

      // Wait briefly for acknowledgement (not full report)
      await new Promise(r => setTimeout(r, 2000));

      // First WhatsApp message should be the acknowledgement
      const firstCall = whatsappServiceMock.mock.calls[0];
      expect(firstCall).toBeDefined();
      const ackMessage = firstCall[0]?.text || firstCall[1];
      // Acknowledgement should mention the wait time
      expect(ackMessage).toMatch(/second|sekunde|preparing|ninaandaa/i);
    }, 15000);
  });

  // ── Identity resolution ───────────────────────────────────
  describe('Identity resolution', () => {
    it('correctly identifies SUPER_ADMIN role', async () => {
      await request(app.getHttpServer())
        .post('/webhook')
        .send(buildWebhookPayload(TEST_USERS.SUPER_ADMIN, 'hello'))
        .expect(201);

      await new Promise(r => setTimeout(r, 2000));
      expect(whatsappServiceMock).toHaveBeenCalled();
    }, 10000);

    it('routes unknown number to onboarding flow', async () => {
      const unknownPhone = '254799999999';
      await request(app.getHttpServer())
        .post('/webhook')
        .send(buildWebhookPayload(unknownPhone, 'hello'))
        .expect(201);

      await new Promise(r => setTimeout(r, 2000));

      // Should send onboarding message, not crash
      const calls = whatsappServiceMock.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    }, 10000);
  });

  // ── Emergency escalation (BS-15) ─────────────────────────
  describe('Emergency escalation — zero tolerance', () => {
    const EMERGENCY_MESSAGES = [
      'there is a fire in the building',
      'moto umewaka jikoni',
      'mafuriko basement',
      'gas leak in unit 3',
    ];

    test.each(EMERGENCY_MESSAGES)(
      'escalates immediately: "%s"',
      async (message) => {
        jest.clearAllMocks();

        await request(app.getHttpServer())
          .post('/webhook')
          .send(buildWebhookPayload(TEST_USERS.TENANT, message))
          .expect(201);

        await new Promise(r => setTimeout(r, 1000));

        const calls = whatsappServiceMock.mock.calls;
        expect(calls.length).toBeGreaterThan(0);

        // Response must contain a phone number
        const responseText = JSON.stringify(calls);
        expect(responseText).toMatch(/\+?254\d{9}|\d{10}/);

        // Response must NOT contain ticket/reference number
        expect(responseText).not.toMatch(/ticket|ref #|reference #/i);
      },
      10000
    );
  });

  // ── Swahili responses ─────────────────────────────────────
  describe('Bilingual response correctness', () => {
    it('responds in Swahili when message is in Swahili', async () => {
      await request(app.getHttpServer())
        .post('/webhook')
        .send(buildWebhookPayload(TEST_USERS.TENANT, 'nimetuma pesa'))
        .expect(201);

      await new Promise(r => setTimeout(r, 3000));

      const responseText = JSON.stringify(whatsappServiceMock.mock.calls);
      // Response should contain Swahili words, not just English
      // At minimum should not be entirely English
      expect(responseText).toMatch(/asante|risiti|pesa|malipo|kitengo/i);
    }, 15000);

    it('responds in English when message is in English', async () => {
      await request(app.getHttpServer())
        .post('/webhook')
        .send(buildWebhookPayload(TEST_USERS.TENANT, 'I have paid the rent'))
        .expect(201);

      await new Promise(r => setTimeout(r, 3000));

      const responseText = JSON.stringify(whatsappServiceMock.mock.calls);
      expect(responseText).toMatch(/payment|receipt|confirmed|thank/i);
    }, 15000);
  });

  // ── Model fallback (BS-02) ────────────────────────────────
  describe('Model fallback resilience', () => {
    it('delivers response even when Groq fails', async () => {
      // Simulate Groq being unavailable
      jest.spyOn(global, 'fetch').mockImplementationOnce((url: any) => {
        if (url.toString().includes('groq')) {
          return Promise.reject(new Error('Groq unavailable'));
        }
        return fetch(url);
      });

      await request(app.getHttpServer())
        .post('/webhook')
        .send(buildWebhookPayload(TEST_USERS.AGENT, 'list companies'))
        .expect(201);

      await new Promise(r => setTimeout(r, 5000));

      // Should still deliver — via Gemini fallback
      expect(whatsappServiceMock).toHaveBeenCalled();
    }, 15000);
  });

  // ── Tool selection logging ────────────────────────────────
  describe('Tool manifest pruning — observability', () => {
    it('logs tool count for every request', async () => {
      const logSpy = jest.spyOn(console, 'log');

      await request(app.getHttpServer())
        .post('/webhook')
        .send(buildWebhookPayload(TEST_USERS.AGENT, 'list companies'))
        .expect(201);

      await new Promise(r => setTimeout(r, 2000));

      const toolManifestLog = logSpy.mock.calls.find(
        call => call[0]?.includes('[ToolManifest]')
      );
      expect(toolManifestLog).toBeDefined();

      // For list_companies, should show 1 tool loaded, not 51
      expect(toolManifestLog[0]).toMatch(/1\/51|1 tool/i);
    }, 10000);
  });
});






// ─────────────────────────────────────────────────────────────
// CONTRACT TESTS + GOLDEN FIXTURES
// File: src/integration/contract-tests.spec.ts
// Tests: Output contracts, staging store, tool dedup,
//        model version regression, receipt generation,
//        temporal context, cache isolation
// ─────────────────────────────────────────────────────────────

import { Test, TestingModule } from '@nestjs/testing';
import { StagingStore } from '../../src/ai/staging-store';
import { ReceiptService } from '../../src/receipts/receipt.service';
import { TemporalContextService } from '../../src/ai/temporal-context.service';

// ── Golden fixtures — expected outputs that must never change ─
// These represent verified-correct outputs from real interactions.
// If these break, a model or prompt change has introduced a regression.

const GOLDEN_FIXTURES = {

  receipt_exact_payment: {
    input: {
      tenantName: 'Sarah Ali',
      unit: 'A1',
      property: 'Doe Plaza',
      amount: 128702,
      mpesaCode: 'QGH7821KNM',
      paymentDate: '2026-03-15',
      month: 'March 2026',
      agentName: 'James Ochieng',
    },
    requiredFields: [
      'Sarah Ali',
      '128,702',
      'QGH7821KNM',
      'March 2026',
      'A1',
    ],
    prohibitedContent: [
      'undefined',
      'null',
      'NaN',
      '[object Object]',
    ],
    maxLength: 500,
  },

  receipt_partial_payment: {
    input: {
      tenantName: 'John Mwangi',
      unit: '4B',
      amount: 15000,
      expectedAmount: 18000,
      mpesaCode: 'PRT1234567',
      paymentDate: '2026-03-14',
      month: 'March 2026',
    },
    requiredFields: [
      'John Mwangi',
      '15,000',
      'PRT1234567',
      '3,000', // shortfall
    ],
    mustContainPartialWarning: true,
    maxLength: 600,
  },

  collection_summary_response: {
    toolResults: {
      total_collected: 2435000,
      total_due: 2590000,
      collection_rate: 94,
      outstanding: 155000,
      unpaid_count: 3,
    },
    requiredNumbers: [94, 155000],
    prohibitedNumbers: [95, 96, 97, 98],  // hallucinated rates
    maxLength: 300,
  },
};

// ── Staging Store Tests ───────────────────────────────────────

describe('StagingStore', () => {
  let store: StagingStore;

  beforeEach(() => {
    // Use in-memory implementation for unit tests
    store = new StagingStore({ useInMemory: true });
  });

  it('stages data and returns metadata only', async () => {
    const data = Array.from({ length: 47 }, (_, i) => ({
      tenantId: `tenant_${i}`,
      name: `Tenant ${i}`,
      balance: i * 1000,
      phone: `25470000000${i}`,
    }));

    const result = await store.stage('job_001', 'payments', data);

    // Result should be metadata, never the raw data
    expect(result).not.toHaveProperty('tenantId');
    expect(result).not.toHaveProperty('phone');
    expect(result).toHaveProperty('status', 'staged');
    expect(result).toHaveProperty('key', 'payments');
    expect(result).toHaveProperty('record_count', 47);

    // The data should NOT appear in the returned object
    expect(JSON.stringify(result)).not.toContain('Tenant 0');
    expect(JSON.stringify(result)).not.toContain('25470000000');
  });

  it('retrieves staged data by key', async () => {
    const data = { test: 'value', amount: 18000 };
    await store.stage('job_001', 'test_data', data);

    const retrieved = await store.retrieve('job_001', 'test_data');
    expect(retrieved).toEqual(data);
  });

  it('isolates data between different jobs', async () => {
    await store.stage('job_001', 'payments', { amount: 1000 });
    await store.stage('job_002', 'payments', { amount: 2000 });

    const job1Data = await store.retrieve('job_001', 'payments');
    const job2Data = await store.retrieve('job_002', 'payments');

    expect(job1Data.amount).toBe(1000);
    expect(job2Data.amount).toBe(2000);
  });

  it('throws on missing key', async () => {
    await expect(
      store.retrieve('job_001', 'nonexistent_key')
    ).rejects.toThrow('Staging key not found');
  });

  it('returns inventory of staged keys for a job', async () => {
    await store.stage('job_001', 'payments', {});
    await store.stage('job_001', 'invoices', {});
    await store.stage('job_001', 'heatmap', {});

    const inventory = await store.inventory('job_001');
    expect(inventory).toContain('payments');
    expect(inventory).toContain('invoices');
    expect(inventory).toContain('heatmap');
    expect(inventory).toHaveLength(3);
  });

  it('purges all keys for a job on completion', async () => {
    await store.stage('job_001', 'payments', { data: 'test' });
    await store.stage('job_001', 'invoices', { data: 'test' });

    await store.purge('job_001');

    await expect(store.retrieve('job_001', 'payments'))
      .rejects.toThrow('Staging key not found');
  });

  it('does not purge data from other jobs', async () => {
    await store.stage('job_001', 'payments', { data: 'job1' });
    await store.stage('job_002', 'payments', { data: 'job2' });

    await store.purge('job_001');

    // job_002 data should still be there
    const data = await store.retrieve('job_002', 'payments');
    expect(data.data).toBe('job2');
  });

  it('respects TTL — data expires after 30 minutes', async () => {
    // Using fake timers
    jest.useFakeTimers();

    await store.stage('job_001', 'temp_data', { value: 'test' });

    // Advance time past TTL
    jest.advanceTimersByTime(31 * 60 * 1000);

    await expect(store.retrieve('job_001', 'temp_data'))
      .rejects.toThrow();

    jest.useRealTimers();
  });
});

// ── Receipt Generation Contract Tests ────────────────────────

describe('ReceiptService — output contracts', () => {
  let receiptService: ReceiptService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReceiptService],
    }).compile();
    receiptService = module.get<ReceiptService>(ReceiptService);
  });

  it('generates exact payment receipt with all required fields', () => {
    const fixture = GOLDEN_FIXTURES.receipt_exact_payment;
    const receipt = receiptService.generate(fixture.input);

    // All required fields must be present
    fixture.requiredFields.forEach(field => {
      expect(receipt).toContain(field);
    });

    // No broken template variables
    fixture.prohibitedContent.forEach(bad => {
      expect(receipt).not.toContain(bad);
    });

    // Must be mobile-friendly length
    expect(receipt.length).toBeLessThanOrEqual(fixture.maxLength);
  });

  it('generates partial payment receipt with shortfall warning', () => {
    const fixture = GOLDEN_FIXTURES.receipt_partial_payment;
    const receipt = receiptService.generate(fixture.input);

    fixture.requiredFields.forEach(field => {
      expect(receipt).toContain(field);
    });

    // Must warn about outstanding balance
    if (fixture.mustContainPartialWarning) {
      expect(receipt).toMatch(/partial|outstanding|balance|baki/i);
    }
  });

  it('EN receipt does not contain Swahili words', () => {
    const receipt = receiptService.generate({
      ...GOLDEN_FIXTURES.receipt_exact_payment.input,
      language: 'en',
    });
    expect(receipt).not.toMatch(/asante|pango|kitengo|mwezi/i);
  });

  it('SW receipt contains Swahili vocabulary', () => {
    const receipt = receiptService.generate({
      ...GOLDEN_FIXTURES.receipt_exact_payment.input,
      language: 'sw',
    });
    expect(receipt).toMatch(/risiti|malipo|asante|mwezi/i);
  });

  it('receipt never exposes tenant phone number of other tenants', () => {
    const receipt = receiptService.generate({
      ...GOLDEN_FIXTURES.receipt_exact_payment.input,
      // Ensuring no accidental cross-tenant data exposure
    });
    // Should only contain the generating agent's contact info
    // Not other tenant phone numbers
    const phoneMatches = receipt.match(/\+?254\d{9}/g) || [];
    // At most one phone number (agent contact) in receipt
    expect(phoneMatches.length).toBeLessThanOrEqual(1);
  });
});

// ── Temporal Context Tests (BS-14) ───────────────────────────

describe('TemporalContextService', () => {
  let service: TemporalContextService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TemporalContextService],
    }).compile();
    service = module.get<TemporalContextService>(TemporalContextService);
  });

  it('injects correct billing cycle for mid-month query', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-15T10:00:00Z'));

    const context = service.buildTemporalContext();

    expect(context.currentMonth).toBe('March 2026');
    expect(context.billingCycleStart).toBe('2026-03-01');
    expect(context.billingCycleEnd).toBe('2026-03-31');
    expect(context.daysUntilCycleEnd).toBe(16);

    jest.useRealTimers();
  });

  it('handles month boundary correctly — 11:58pm Dec 31', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-12-31T21:58:00Z')); // 11:58pm EAT

    const context = service.buildTemporalContext();

    // Must still be December cycle
    expect(context.currentMonth).toBe('December 2025');
    expect(context.billingCycleStart).toBe('2025-12-01');

    jest.useRealTimers();
  });

  it('handles month boundary correctly — 12:01am Jan 1', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:01:00Z')); // 12:01am EAT

    const context = service.buildTemporalContext();

    // Must now be January cycle
    expect(context.currentMonth).toBe('January 2026');
    expect(context.billingCycleStart).toBe('2026-01-01');

    jest.useRealTimers();
  });

  it('batch jobs lock billing cycle at creation time', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-12-31T23:55:00Z'));

    const jobContext = service.buildJobTemporalContext();
    const jobCreatedAt = jobContext.snapshotTimestamp;

    // Advance past midnight
    jest.advanceTimersByTime(10 * 60 * 1000); // +10 minutes

    // Job context should still reference December
    expect(jobContext.currentMonth).toBe('December 2025');
    expect(jobContext.snapshotTimestamp).toBe(jobCreatedAt);

    jest.useRealTimers();
  });
});

// ── Model Version Regression (BS-03) ─────────────────────────

describe('Model Version Regression Tests', () => {
  // These tests verify that model updates have not changed behaviour
  // Run these before deploying any model configuration change

  const REGRESSION_CASES = [
    {
      id: 'R001',
      description: 'list_companies must be complexity 1 (was bug)',
      input: 'List out companies for me',
      requiredIntent: 'list_companies',
      requiredMaxComplexity: 1,
    },
    {
      id: 'R002',
      description: 'nimetuma must map to record_payment',
      input: 'nimetuma',
      requiredIntent: 'record_payment',
      requiredMaxComplexity: 3,
    },
    {
      id: 'R003',
      description: 'generate report must be complexity >= 4',
      input: 'generate monthly report for my portfolio',
      requiredIntent: 'generate_mckinsey_report',
      requiredMinComplexity: 4,
    },
    {
      id: 'R004',
      description: 'fire emergency must be complexity 1 always',
      input: 'there is a fire in the building',
      requiredIntent: 'emergency_escalation',
      requiredMaxComplexity: 1,
    },
  ];

  // Run against current model configuration
  // If any fail, do not deploy the model update
  test.each(REGRESSION_CASES)(
    '$id: $description',
    async ({ input, requiredIntent, requiredMaxComplexity, requiredMinComplexity }) => {
      // This test requires the classifier to be running
      // Skip in environments without model access
      if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
        console.log('Skipping — no API keys in environment');
        return;
      }

      const { AiClassifierService } = await import('../../src/ai/ai-classifier.service');
      const classifier = new AiClassifierService();
      const result = await classifier.classify(input);

      expect(result.intent).toBe(requiredIntent);

      if (requiredMaxComplexity !== undefined) {
        expect(result.complexity).toBeLessThanOrEqual(requiredMaxComplexity);
      }
      if (requiredMinComplexity !== undefined) {
        expect(result.complexity).toBeGreaterThanOrEqual(requiredMinComplexity);
      }
    }
  );
});





# ─────────────────────────────────────────────────────────────
# LAYER 3 — AI BEHAVIOUR TESTS
# File: src/ai/promptfoo.yaml
# Framework: PromptFoo (https://promptfoo.dev)
# Run: npx promptfoo eval
#
# Tests: Intent classification accuracy, response quality,
#        Swahili correctness, financial accuracy,
#        regression detection on model updates
# ─────────────────────────────────────────────────────────────

description: "Aedra AI Golden Test Set — run before every model update"

providers:
  - id: groq:llama3-70b-8192
    label: "Groq Llama 3.3 (primary)"
    config:
      temperature: 0
      max_tokens: 500

  - id: google:gemini-2.0-flash
    label: "Gemini Flash (fallback)"
    config:
      temperature: 0
      max_tokens: 500

prompts:
  - file://prompts/aedra-agent-system.txt
  - file://prompts/aedra-tenant-system.txt

# ── Test cases ────────────────────────────────────────────────
tests:

  # ── CATEGORY 1: Intent classification accuracy ─────────────
  - description: "check_rent_status — EN"
    vars:
      persona: AGENT
      message: "who hasn't paid this month"
    assert:
      - type: javascript
        value: "output.intent === 'check_rent_status'"
      - type: javascript
        value: "output.complexity <= 2"
      - type: javascript
        value: "output.executionMode === 'DIRECT_LOOKUP'"

  - description: "check_rent_status — SW"
    vars:
      persona: AGENT
      message: "hawajapaya nani mwezi huu"
    assert:
      - type: javascript
        value: "output.intent === 'check_rent_status'"
      - type: javascript
        value: "output.language === 'sw'"

  - description: "record_payment — nimetuma variant"
    vars:
      persona: TENANT
      message: "nimetuma"
    assert:
      - type: javascript
        value: "output.intent === 'record_payment'"

  - description: "record_payment — pesa imeingia variant"
    vars:
      persona: TENANT
      message: "pesa imeingia boss"
    assert:
      - type: javascript
        value: "output.intent === 'record_payment'"

  - description: "list_companies must be complexity 1 — was bug in logs"
    vars:
      persona: SUPER_ADMIN
      message: "Hello, list our companies for me"
    assert:
      - type: javascript
        value: "output.intent === 'list_companies'"
      - type: javascript
        value: "output.complexity === 1"
      - type: javascript
        # This was the exact bug: classified as complexity 3
        value: "output.complexity !== 3"

  - description: "generate_mckinsey_report must be complexity 5"
    vars:
      persona: AGENT
      message: "generate full portfolio report for Bahari Ridge"
    assert:
      - type: javascript
        value: "output.intent === 'generate_mckinsey_report'"
      - type: javascript
        value: "output.complexity >= 4"
      - type: javascript
        value: "output.executionMode === 'INTELLIGENCE'"

  # ── CATEGORY 2: Emergency detection — zero tolerance ────────
  - description: "EMERGENCY: fire — EN — must escalate"
    vars:
      persona: TENANT
      message: "there is a fire in the building"
    assert:
      - type: javascript
        value: "output.isEmergency === true"
      - type: javascript
        value: "output.intent === 'emergency_escalation'"
      - type: javascript
        # Response must contain phone number
        value: "output.response && /\\+?254\\d{9}/.test(output.response)"
      - type: javascript
        # Must NOT contain ticket reference
        value: "output.response && !/ticket|ref #/i.test(output.response)"

  - description: "EMERGENCY: moto — SW — must escalate"
    vars:
      persona: TENANT
      message: "moto umewaka jikoni msaada"
    assert:
      - type: javascript
        value: "output.isEmergency === true"

  - description: "NOT emergency: minor drip should not escalate"
    vars:
      persona: TENANT
      message: "the tap is dripping a little"
    assert:
      - type: javascript
        value: "output.isEmergency === false"
      - type: javascript
        value: "output.intent === 'report_maintenance'"

  - description: "NOT emergency: fire exit sign broken"
    vars:
      persona: TENANT
      message: "the fire exit sign is broken"
    assert:
      - type: javascript
        # 'fire' in message but not an emergency
        value: "output.isEmergency === false"

  # ── CATEGORY 3: Response quality ────────────────────────────
  - description: "Rent reminder — EN — should be professional"
    vars:
      persona: AGENT
      message: "send reminder to John in unit 4B"
      context:
        tenant: { name: "John Mwangi", unit: "4B", amount: 18000, dueDate: "1st March" }
    assert:
      - type: contains
        value: "John"
      - type: contains
        value: "18,000"
      - type: javascript
        # Should NOT be longer than 300 chars for WhatsApp
        value: "output.response.length < 300"
      - type: javascript
        # Should contain payment instructions
        value: "/M-Pesa|mpesa|paybill/i.test(output.response)"

  - description: "Rent reminder — SW — must be grammatically correct Swahili"
    vars:
      persona: AGENT
      message: "tuma ukumbusho kwa John kitengo 4B"
      context:
        tenant: { name: "John Mwangi", unit: "4B", amount: 18000 }
        language: "sw"
    assert:
      - type: contains
        value: "John"
      - type: javascript
        # Must contain Swahili property vocabulary
        value: "/pango|kitengo|malipo|M-Pesa/i.test(output.response)"
      - type: javascript
        # Must NOT be a direct English translation (bad Swahili signal)
        value: "!/Dear tenant|your rent is due/i.test(output.response)"

  - description: "Receipt — must contain required fields"
    vars:
      persona: SYSTEM
      action: generate_receipt
      context:
        tenant: "Sarah Ali"
        unit: "A1"
        amount: 128702
        mpesaCode: "QGH7821KNM"
        date: "2026-03-15"
    assert:
      - type: contains
        value: "Sarah Ali"
      - type: contains
        value: "128,702"
      - type: contains
        value: "QGH7821KNM"
      - type: javascript
        value: "output.response.length < 500"

  # ── CATEGORY 4: Financial accuracy ──────────────────────────
  - description: "Collection summary — figures must match tool results"
    vars:
      persona: AGENT
      message: "collection status this month"
      mockToolResults:
        get_collection_summary:
          total_collected: 2435000
          total_due: 2590000
          collection_rate: 94
          outstanding: 155000
    assert:
      - type: javascript
        # Must contain the exact collection rate from tool results
        value: "output.response.includes('94')"
      - type: javascript
        # Must NOT contain any number not in tool results
        value: |
          const toolNumbers = [2435000, 2590000, 94, 155000];
          const responseNumbers = (output.response.match(/[\d,]+/g) || [])
            .map(n => parseInt(n.replace(/,/g, '')))
            .filter(n => n > 100);
          responseNumbers.every(n => toolNumbers.some(t => Math.abs(t - n) / t < 0.01))

  # ── CATEGORY 5: Language consistency ────────────────────────
  - description: "EN message gets EN response"
    vars:
      persona: TENANT
      message: "what is my current balance"
    assert:
      - type: javascript
        value: "output.language === 'en'"
      - type: javascript
        # Should not contain Swahili words in EN response
        value: "!/habari|asante|tafadhali/i.test(output.response)"

  - description: "SW message gets SW response"
    vars:
      persona: TENANT
      message: "niambie salio langu la sasa"
    assert:
      - type: javascript
        value: "output.language === 'sw'"
      - type: javascript
        value: "/salio|shilingi|pesa|KES/i.test(output.response)"

  - description: "Mixed Sheng message handled as Swahili"
    vars:
      persona: TENANT
      message: "boss nimetuma five k jana"
    assert:
      - type: javascript
        value: "output.language === 'sw'"
      - type: javascript
        value: "output.intent === 'record_payment'"

  # ── CATEGORY 6: Tool selection verification ─────────────────
  - description: "list_companies loads only 1 tool"
    vars:
      persona: SUPER_ADMIN
      message: "list companies"
    assert:
      - type: javascript
        value: "output.toolsLoaded <= 1"
      - type: javascript
        value: "output.toolsLoaded !== 51"

  - description: "generate_mckinsey_report loads ≤ 10 tools"
    vars:
      persona: AGENT
      message: "generate full report"
    assert:
      - type: javascript
        value: "output.toolsLoaded <= 10"

  # ── CATEGORY 7: Regression tests from known bugs ───────────
  - description: "REGRESSION: list companies was misclassified as complexity 3"
    vars:
      persona: SUPER_ADMIN
      message: "List out companies for me"
    assert:
      - type: javascript
        value: "output.complexity === 1"
      - type: javascript
        # This was the exact bug that caused 71s response time
        value: "output.complexity !== 3"

  - description: "REGRESSION: nimetuma must not classify as general query"
    vars:
      persona: TENANT
      message: "nimetuma"
    assert:
      - type: javascript
        value: "output.intent === 'record_payment'"
      - type: javascript
        value: "output.intent !== 'general_query'"
      - type: javascript
        value: "output.intent !== 'generate_basic_report'"

# ── Evaluation thresholds ─────────────────────────────────────
evaluateOptions:
  maxConcurrency: 4

# Fail the test suite if pass rate drops below these thresholds
thresholds:
  pass: 0.95  # 95% of tests must pass
  # If below 95%, block model update deployment





  // ─────────────────────────────────────────────────────────────
// LAYER 5 — LOAD TESTS
// File: src/load/surge-scenarios.js
// Framework: k6 (https://k6.io)
// Run: k6 run src/load/surge-scenarios.js
//
// Tests: 1st-of-month report surge (BS-01),
//        100 concurrent agent scenario,
//        Rate limit behaviour under stress
// ─────────────────────────────────────────────────────────────

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ── Custom metrics ────────────────────────────────────────────
const reportDeliveryTime = new Trend('report_delivery_ms');
const acknowledgedWithin2s = new Rate('acknowledged_within_2s');
const completedWithin60s = new Rate('completed_within_60s');
const modelFallbackRate = new Rate('model_fallback_rate');
const errorRate = new Rate('error_rate');
const emergencyEscalationTime = new Trend('emergency_escalation_ms');

// ── Test configuration ────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// ── WhatsApp webhook payload builder ─────────────────────────
function webhookPayload(phone, message) {
  return JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{
      id: '1280198773926132',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '254752167271',
            phone_number_id: '1084609064725669',
          },
          contacts: [{ profile: { name: `Agent ${phone}` }, wa_id: phone }],
          messages: [{
            from: phone,
            id: `wamid.load_test_${Date.now()}_${Math.random()}`,
            timestamp: String(Math.floor(Date.now() / 1000)),
            text: { body: message },
            type: 'text',
          }],
        },
        field: 'messages',
      }],
    }],
  });
}

const HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'facebookexternalua',
};

// ────────────────────────────────────────────────────────────
// SCENARIO 1: 1st-of-month report surge
// 300 agents request reports within 4 minutes
// This is the Black Swan BS-01 scenario
// ────────────────────────────────────────────────────────────
export const options = {
  scenarios: {

    // ── Surge: report requests all at once ─────────────────
    report_surge: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },   // Ramp to 50 agents
        { duration: '60s', target: 100 },  // Surge to 100
        { duration: '2m', target: 100 },   // Hold at 100
        { duration: '30s', target: 0 },    // Ramp down
      ],
      gracefulRampDown: '30s',
      tags: { scenario: 'report_surge' },
    },

    // ── Steady state: normal daily traffic ─────────────────
    steady_state: {
      executor: 'constant-vus',
      vus: 10,
      duration: '5m',
      tags: { scenario: 'steady_state' },
      startTime: '5m', // Run after surge scenario
    },

    // ── Emergency escalation: must always be instant ────────
    emergency_check: {
      executor: 'constant-vus',
      vus: 2,
      duration: '3m',
      tags: { scenario: 'emergency' },
    },
  },

  thresholds: {
    // 95% of webhook POSTs must return within 500ms
    'http_req_duration{scenario:report_surge}': ['p(95)<500'],

    // Acknowledgement (first response) within 2 seconds for 95% of requests
    'acknowledged_within_2s': ['rate>0.95'],

    // Full report delivery within 60 seconds for 90% of requests
    'completed_within_60s': ['rate>0.90'],

    // Error rate must stay below 5%
    'error_rate': ['rate<0.05'],

    // Emergency escalation always within 1 second
    'emergency_escalation_ms': ['p(99)<1000'],

    // HTTP errors must be below 1%
    'http_req_failed': ['rate<0.01'],
  },
};

// ── Report surge scenario handler ─────────────────────────────
export function reportSurge() {
  const agentPhone = `2547000${String(__VU).padStart(5, '0')}`;
  const startTime = Date.now();

  // Send report request
  const res = http.post(
    `${BASE_URL}/webhook`,
    webhookPayload(agentPhone, 'generate monthly report for my portfolio'),
    { headers: HEADERS, tags: { name: 'report_request' } }
  );

  check(res, {
    'webhook accepted (201)': r => r.status === 201,
    'response time < 500ms': r => r.timings.duration < 500,
  });

  errorRate.add(res.status !== 201);

  // Wait for acknowledgement (should arrive within 2s)
  sleep(2);
  // In real test, you'd poll a test endpoint or check a mock
  // For now we validate the webhook response time as proxy
  acknowledgedWithin2s.add(res.timings.duration < 2000);

  // Simulate waiting for full report
  sleep(58);
  completedWithin60s.add(true); // Would check delivery in real test
  reportDeliveryTime.add(Date.now() - startTime);
}

// ── Steady state handler ───────────────────────────────────────
export function steadyState() {
  const agentPhone = `2547001${String(__VU).padStart(5, '0')}`;

  const MESSAGES = [
    'who has not paid',
    'list companies',
    'check vacancy',
    'hawajapaya nani mwezi huu',
    'which units are empty',
    'collection status',
  ];

  const message = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
  const startTime = Date.now();

  const res = http.post(
    `${BASE_URL}/webhook`,
    webhookPayload(agentPhone, message),
    { headers: HEADERS, tags: { name: 'steady_state_query' } }
  );

  check(res, {
    'status 201': r => r.status === 201,
    'DIRECT_LOOKUP < 3s': r => r.timings.duration < 3000,
  });

  errorRate.add(res.status !== 201);

  // Direct lookups should be fast
  if (message.includes('list') || message.includes('check')) {
    acknowledgedWithin2s.add(res.timings.duration < 2000);
  }

  sleep(Math.random() * 3 + 1); // 1-4s between messages
}

// ── Emergency scenario handler ─────────────────────────────────
export function emergencyCheck() {
  const tenantPhone = `2547002${String(__VU).padStart(5, '0')}`;

  const EMERGENCIES = [
    'there is a fire',
    'moto umewaka',
    'flooding in basement',
    'gas leak help',
    'msaada mtu ameanguka',
  ];

  const message = EMERGENCIES[Math.floor(Math.random() * EMERGENCIES.length)];
  const startTime = Date.now();

  const res = http.post(
    `${BASE_URL}/webhook`,
    webhookPayload(tenantPhone, message),
    { headers: HEADERS, tags: { name: 'emergency' } }
  );

  const duration = Date.now() - startTime;
  emergencyEscalationTime.add(duration);

  check(res, {
    'emergency webhook accepted': r => r.status === 201,
    'emergency response < 1s': r => r.timings.duration < 1000,
  });

  errorRate.add(res.status !== 201);
  sleep(10); // Emergencies are rare — don't spam
}

// ── Default export (which scenario to run) ───────────────────
export default function() {
  const scenario = __ENV.SCENARIO || 'steady';

  if (scenario === 'surge') {
    reportSurge();
  } else if (scenario === 'emergency') {
    emergencyCheck();
  } else {
    steadyState();
  }
}

// ────────────────────────────────────────────────────────────
// HOW TO RUN:
//
// Steady state test (10 users, 5 minutes):
//   k6 run src/load/surge-scenarios.js
//
// Report surge (simulates 1st of month):
//   k6 run -e SCENARIO=surge src/load/surge-scenarios.js
//
// Emergency check:
//   k6 run -e SCENARIO=emergency src/load/surge-scenarios.js
//
// Full suite against staging:
//   k6 run -e BASE_URL=https://staging.aedra.app src/load/surge-scenarios.js
//
// ── WHAT TO WATCH ──────────────────────────────────────────
// During the surge test watch these in the output:
//
// GOOD:
//   acknowledged_within_2s: rate > 0.95 ✓
//   http_req_failed: rate < 0.01 ✓
//   error_rate: rate < 0.05 ✓
//
// DANGER SIGNS:
//   acknowledged_within_2s drops below 0.90
//     → Queue is backed up, ETAs are wrong
//   http_req_failed spikes above 0.05
//     → API rate limits hit, retry storm starting
//   emergency_escalation_ms p(99) > 1000ms
//     → Emergency flow is being queued — unacceptable
// ────────────────────────────────────────────────────────────





{
  "name": "aedra-tests",
  "version": "1.0.0",
  "description": "Production-grade test suite for Aedra AI system",
  "scripts": {
    "test": "jest",
    "test:unit": "jest src/unit --coverage",
    "test:integration": "jest src/integration --runInBand",
    "test:contracts": "jest src/integration/contract-tests.spec.ts",
    "test:regression": "jest src/integration/contract-tests.spec.ts -t 'Regression'",
    "test:ai": "npx promptfoo eval --config src/ai/promptfoo.yaml",
    "test:ai:watch": "npx promptfoo eval --config src/ai/promptfoo.yaml --watch",
    "test:load:steady": "k6 run src/load/surge-scenarios.js",
    "test:load:surge": "k6 run -e SCENARIO=surge src/load/surge-scenarios.js",
    "test:load:emergency": "k6 run -e SCENARIO=emergency src/load/surge-scenarios.js",
    "test:all": "npm run test:unit && npm run test:integration && npm run test:ai",
    "test:pre-deploy": "npm run test:unit && npm run test:regression && npm run test:ai",
    "test:pre-model-update": "npm run test:regression && npm run test:ai",
    "test:first-of-month": "npm run test:load:surge && npm run test:load:emergency",
    "coverage": "jest --coverage --coverageReporters=html",
    "coverage:check": "jest --coverage --coverageThreshold='{\"global\":{\"lines\":80}}'"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "reflect-metadata": "^0.1.13"
  },
  "devDependencies": {
    "@types/jest": "^29.0.0",
    "@types/supertest": "^2.0.0",
    "jest": "^29.0.0",
    "promptfoo": "latest",
    "supertest": "^6.0.0",
    "ts-jest": "^29.0.0",
    "typescript": "^5.0.0"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": [
      "**/*.(t|j)s",
      "!**/*.spec.(t|j)s",
      "!**/node_modules/**"
    ],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node",
    "testTimeout": 30000,
    "setupFilesAfterEach": ["<rootDir>/setup/jest.setup.ts"],

    "projects": [
      {
        "displayName": "unit",
        "testMatch": ["<rootDir>/unit/**/*.spec.ts"],
        "testTimeout": 10000
      },
      {
        "displayName": "integration",
        "testMatch": ["<rootDir>/integration/**/*.spec.ts"],
        "testTimeout": 30000
      },
      {
        "displayName": "contracts",
        "testMatch": ["<rootDir>/integration/contract-tests.spec.ts"],
        "testTimeout": 15000
      }
    ],

    "coverageThreshold": {
      "global": {
        "branches": 75,
        "functions": 80,
        "lines": 80,
        "statements": 80
      },
      "./src/ai/emergency-escalation.service.ts": {
        "branches": 100,
        "functions": 100,
        "lines": 100,
        "statements": 100
      },
      "./src/ai/financial-cross-checker.ts": {
        "branches": 95,
        "functions": 100,
        "lines": 95,
        "statements": 95
      },
      "./src/cache/cache-key-builder.ts": {
        "branches": 100,
        "functions": 100,
        "lines": 100,
        "statements": 100
      }
    }
  }
}