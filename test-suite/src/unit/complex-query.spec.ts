import { Test, TestingModule } from '@nestjs/testing';
import { AiClassifierService } from '../../../api/src/ai/ai-classifier.service';
import { WordNetIntentResolver } from '../../../api/src/ai/wordnet-intent-resolver.util';
import { UserRole } from '../../../api/src/auth/roles.enum';

describe('AiClassifierService Complex Query Logic', () => {
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

  it('should force PLANNING mode when attachments are present (attachmentCount > 0)', async () => {
    // Short message with attachment
    const result = await classifier.classify('here is the file', UserRole.COMPANY_STAFF, [], 1);
    
    expect(result.executionMode).toBe('PLANNING');
    expect(result.hasAttachments).toBe(true);
    expect(result.complexity).toBeGreaterThanOrEqual(3);
  });

  it('should force PLANNING mode for long paragraphs (sentenceCount > 2)', async () => {
    const longMessage = 'First sentence of the request. Second sentence of the request. Third sentence of the request that makes it complex.';
    const result = await classifier.classify(longMessage, UserRole.COMPANY_STAFF, [], 0);
    
    expect(result.executionMode).toBe('PLANNING');
    expect(result.isLongRequest).toBe(true);
    expect(result.complexity).toBeGreaterThanOrEqual(3);
  });

  it('should use normal mode for short messages without attachments', async () => {
    const result = await classifier.classify('list properties', UserRole.COMPANY_STAFF, [], 0);
    
    expect(result.executionMode).not.toBe('PLANNING');
    expect(result.hasAttachments).toBe(false);
  });
});
