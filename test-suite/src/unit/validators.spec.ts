import { ConversationStateValidator } from '../../../api/src/ai/conversation-state-validator';
import { FinancialCrossChecker } from '../../../api/src/ai/financial-cross-checker';
import { EmergencyEscalationService } from '../../../api/src/ai/emergency-escalation.service';
import { CacheKeyBuilder } from '../../../api/src/ai/cache-key-builder';

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
  });

  describe('Corrupted histories — must be repaired', () => {
    it('detects and repairs dangling tool call (no result)', () => {
      const history: any[] = [
        { role: 'user', content: 'check balance' },
        { role: 'assistant', content: '', tool_calls: [
          { id: 'call_1', function: { name: 'get_balance' } }
        ]},
        { role: 'user', content: 'hello' },
      ];
      const result = validator.validate(history);
      expect(result.valid).toBe(false);
      expect(result.repaired).toBe(true);
      expect(result.repairedHistory).toBeDefined();
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
  });

  describe('Hallucinated figures — must be caught', () => {
    it('fails when response contains number not in tool results', () => {
      const toolResults = [
        { tool: 'get_collection_summary', result: {
          total_collected: 2435000,
          collection_rate: 94,
        }}
      ];

      const response = 'Your collection rate this month is 97%.';

      const result = checker.verify(response, toolResults);
      expect(result.passed).toBe(false);
      expect(result.unverifiedNumbers).toContain(97);
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
    expect(key).toMatch(/user_123:/);
  });

  it('two different users never produce the same cache key', () => {
    const key1 = builder.build({ userId: 'agent_A', intent: 'check_rent_status' });
    const key2 = builder.build({ userId: 'agent_B', intent: 'check_rent_status' });
    expect(key1).not.toBe(key2);
  });
});
