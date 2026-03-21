import { AiService } from './ai.service';
import { UserRole } from '../auth/roles.enum';
import { SKILLS_REGISTRY } from './skills.registry';

jest.mock('../common/utils/language.util', () => ({
  detectLanguage: jest.fn(() => 'en'),
  DetectedLanguage: {
    EN: 'en',
    SW: 'sw',
    MIXED: 'mixed',
  },
}));

describe('AiService Supervision & Self-Consistency', () => {
  let aiService: AiService;
  let mockPrisma: any;
  let mockStaging: any;
  let mockCritic: any;
  let mockPipeline: any;

  beforeEach(() => {
    mockPrisma = {
      chatMessage: {
        create: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    mockStaging = { purge: jest.fn() };
    mockCritic = { evaluate: jest.fn() };
    mockPipeline = { processResponse: jest.fn() };

    aiService = {
      prisma: mockPrisma,
      staging: mockStaging,
      critic: mockCritic,
      responsePipeline: mockPipeline,
      logger: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
      detectSkill: (AiService.prototype as any).detectSkill,
      resolveConsistency: (AiService.prototype as any).resolveConsistency,
      sampleStructuredOutput: (AiService.prototype as any)
        .sampleStructuredOutput,
      runSupervisedLoop: (AiService.prototype as any).runSupervisedLoop,
    } as any;
  });

  describe('detectSkill (Dynamic)', () => {
    it('should detect rent_reminder by key overlap', () => {
      const json = JSON.stringify({
        status: 'PAID',
        amount_due: 100,
        last_payment_date: '2023-01-01',
      });
      const skillId = (aiService as any).detectSkill(json);
      expect(skillId).toBe('check_rent_status'); // Matches keys from check_rent_status
    });

    it('should detect generate_mckinsey_report by key overlap', () => {
      const json = JSON.stringify({
        report_url: 'http://link.pdf',
        key_finding: 'Revenue is up',
      });
      const skillId = (aiService as any).detectSkill(json);
      expect(skillId).toBe('generate_mckinsey_report');
    });

    it('should return null if no skill matches', () => {
      const json = JSON.stringify({ random_key: 'random_val' });
      const skillId = (aiService as any).detectSkill(json);
      expect(skillId).toBeNull();
    });
  });

  describe('resolveConsistency', () => {
    it('should pick the majority winner from samples', () => {
      const samples = [
        JSON.stringify({ val: 100 }),
        JSON.stringify({ val: 200 }),
        JSON.stringify({ val: 100 }),
      ];
      const result = (aiService as any).resolveConsistency(samples);
      expect(JSON.parse(result).val).toBe(100);
    });

    it('should handle variations in key order (canonicalization)', () => {
      const samples = ['{"a":1,"b":2}', '{"b":2,"a":1}', '{"a":1,"b":3}'];
      const result = (aiService as any).resolveConsistency(samples);
      const parsed = JSON.parse(result);
      expect(parsed.a).toBe(1);
      expect(parsed.b).toBe(2);
    });
  });

  describe('runSupervisedLoop', () => {
    it('should return pipeline output if critic passes', async () => {
      mockCritic.evaluate.mockResolvedValue({ pass: true, feedback: [] });
      mockPipeline.processResponse.mockResolvedValue({
        success: true,
        output: 'Formatted Response',
      });

      const result = await (aiService as any).runSupervisedLoop(
        'check_rent_status',
        '{}',
        'context',
        {},
      );

      expect(result).toBe('Formatted Response');
      expect(mockCritic.evaluate).toHaveBeenCalled();
    });

    it('should attempt correction if critic fails once', async () => {
      // First pass: Fail
      mockCritic.evaluate
        .mockResolvedValueOnce({ pass: false, feedback: ['Mismatch'] })
        // Second pass: Pass
        .mockResolvedValueOnce({ pass: true, feedback: [] });

      const mockChat = {
        sendMessage: jest.fn().mockResolvedValue({
          response: {
            candidates: [
              {
                content: {
                  parts: [
                    { text: 'JSON_STRUCTURED_OUTPUT: {"status":"PAID"}' },
                  ],
                },
              },
            ],
          },
        }),
      };

      mockPipeline.processResponse.mockResolvedValue({
        success: true,
        output: 'Corrected Response',
      });

      const result = await (aiService as any).runSupervisedLoop(
        'check_rent_status',
        '{}',
        'context',
        mockChat,
      );

      expect(result).toBe('Corrected Response');
      expect(mockChat.sendMessage).toHaveBeenCalled();
      expect(mockCritic.evaluate).toHaveBeenCalledTimes(2);
    });
  });
});
