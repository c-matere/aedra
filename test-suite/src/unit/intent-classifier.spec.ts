import { Test, TestingModule } from '@nestjs/testing';
import { AiClassifierService } from '../../../api/src/ai/ai-classifier.service';
import { WordNetIntentResolver } from '../../../api/src/ai/wordnet-intent-resolver.util';
import { selectTools, INTENT_TOOL_MAP } from '../../../api/src/ai/ai-tool-selector.util';

// ── Types ─────────────────────────────────────────────────────
interface ClassificationResult {
  intent: string;
  complexity: number;
  executionMode: 'DIRECT_LOOKUP' | 'LIGHT_COMPOSE' | 'ORCHESTRATED' | 'INTELLIGENCE' | 'PLANNING';
  language: 'en' | 'sw' | 'mixed';
  hasAttachments?: boolean;
}

// ── Test data: the probability space ─────────────────────────
const AGENT_MESSAGES = [
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
  }
];

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

const DIRECT_LOOKUP_QUERIES = [
  'list companies',
  'list our companies',
  'how many tenants do we have',
  'which units are vacant',
  'show me companies',
  'vitengo vipi viko wazi',
];

describe('AiClassifierService', () => {
  let classifier: AiClassifierService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiClassifierService,
        {
          provide: WordNetIntentResolver,
          useValue: {
            initialize: jest.fn().mockResolvedValue(undefined),
            resolve: jest.fn().mockReturnValue({ route: 'HINT', intent: 'unknown', confidence: 0 }),
          },
        },
      ],
    }).compile();

    classifier = module.get<AiClassifierService>(AiClassifierService);
  });

  describe('Intent Classification', () => {
    test.each(AGENT_MESSAGES)(
      '$description',
      async ({ message, expectedIntent, expectedComplexity, expectedMode, expectedLang }) => {
        const result: any = await classifier.classify(message, 'COMPANY_STAFF' as any, [], 0);

        expect(result.intent).toBe(expectedIntent);
        expect(result.language).toBe(expectedLang);

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

  describe('Complexity Calibration — no over-routing', () => {
    test.each(DIRECT_LOOKUP_QUERIES)(
      'DIRECT_LOOKUP: "%s" must not touch expensive model',
      async (message) => {
        const result: any = await classifier.classify(message, 'COMPANY_STAFF' as any, [], 0);
        expect(result.complexity).toBe(1);
        expect(result.executionMode).toBe('DIRECT_LOOKUP');
      }
    );
  });

  describe('Emergency Signal Detection — must never miss', () => {
    test.each(EMERGENCY_MESSAGES)(
      'Emergency detected: "$message"',
      async ({ message }) => {
        const result: any = await classifier.classify(message, 'TENANT' as any, [], 0);
        expect(result.intent).toBe('emergency_escalation');
        expect(result.complexity).toBe(1);
        expect(result.executionMode).toBe('DIRECT_LOOKUP');
      }
    );
  });

  describe('Language Detection', () => {
    it('detects English correctly', async () => {
      const result: any = await classifier.classify('show me all unpaid tenants', 'COMPANY_STAFF' as any, [], 0);
      expect(result.language).toBe('en');
    });

    it('detects Swahili correctly', async () => {
      const result: any = await classifier.classify('nionyeshe wapangaji wote ambao hawajalipa', 'COMPANY_STAFF' as any, [], 0);
      expect(result.language).toBe('sw');
    });

    it('handles mixed Swahili-English (Sheng) as Swahili', async () => {
      const result: any = await classifier.classify('boss nimetuma pesa jana si leo', 'TENANT' as any, [], 0);
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
        const result: any = await classifier.classify(msg, 'TENANT' as any, [], 0);
        expect(result.intent).toBe('record_payment');
      }
    });
  });
});

describe('Tool Selection Layer', () => {
  describe('Tool manifest pruning', () => {
    const dummyTools = Array.from({ length: 51 }, (_, i) => ({ name: `tool_${i}` }));
    // Add real tool names for specific tests
    dummyTools.push({ name: 'list_companies' });
    dummyTools.push({ name: 'get_portfolio_arrears' });
    dummyTools.push({ name: 'list_payments' });
    dummyTools.push({ name: 'list_invoices' });

    it('list_companies loads exactly 1 tool', () => {
      const tools = selectTools('list_companies', { id: 'SUPER_ADMIN', allowedTools: ['list_companies'] } as any, dummyTools);
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('list_companies');
    });

    it('check_rent_status loads ≤ 3 tools', () => {
      const tools = selectTools('check_rent_status', { id: 'STAFF', allowedTools: ['get_portfolio_arrears', 'list_payments', 'list_invoices'] } as any, dummyTools);
      expect(tools.length).toBeLessThanOrEqual(3);
    });

    it('never loads more than 51 tools for any intent', () => {
        Object.keys(INTENT_TOOL_MAP).forEach(intent => {
          const tools = selectTools(intent, { id: 'SUPER_ADMIN', allowedTools: dummyTools.map(t => t.name) } as any, dummyTools);
          expect(tools.length).toBeLessThanOrEqual(51);
        });
    });
  });
});
