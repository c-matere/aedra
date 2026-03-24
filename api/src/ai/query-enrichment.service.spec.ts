import { Test, TestingModule } from '@nestjs/testing';
import { QueryEnrichmentService } from './query-enrichment.service';

describe('QueryEnrichmentService', () => {
  let service: QueryEnrichmentService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [QueryEnrichmentService],
    }).compile();

    service = moduleRef.get<QueryEnrichmentService>(QueryEnrichmentService);
  });

  afterEach(async () => {
    await moduleRef?.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should not enrich long messages', async () => {
    const longMessage =
      'This is a very long and detailed message that should definitely not be enriched by the service because it already has enough information.';
    const result = await service.enrich(longMessage, [], {
      role: 'COMPANY_ADMIN',
    });
    expect(result).toBe(longMessage);
  });

  it('should not enrich property interest messages (avoid hallucinations)', async () => {
    const msg = 'im intrested in house 32:"House No. 032"';
    const spy = jest.fn();
    (service as any).groq = {
      chat: { completions: { create: spy } },
    };

    const result = await service.enrich(msg, [], {
      role: 'COMPANY_ADMIN',
      companyId: 'comp_123',
    });

    expect(result).toBe(msg);
    expect(spy).not.toHaveBeenCalled();
  });

  it('should enrich vague messages like "payment history maggy"', async () => {
    const vagueMessage = 'payment history maggy';

    const spy = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content:
              'Please show me the payment history for the tenant named Maggie.',
          },
        },
      ],
    });
    (service as any).groq = {
      chat: { completions: { create: spy } },
    };

    const result = await service.enrich(vagueMessage, [], {
      role: 'COMPANY_ADMIN',
      companyId: 'comp_123',
    });

    expect(result).toContain('Maggie');
    expect(result).toContain('payment history');
    expect(spy).toHaveBeenCalled();
  });

  it('should handle "who hasn\'t paid"', async () => {
    const vagueMessage = "who hasn't paid";

    const spy = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content:
              'Generate an arrears report for all tenants who have not paid their rent for the current month.',
          },
        },
      ],
    });
    (service as any).groq = {
      chat: { completions: { create: spy } },
    };

    const result = await service.enrich(vagueMessage, [], {
      role: 'COMPANY_ADMIN',
      companyId: 'comp_123',
    });

    expect(result.toLowerCase()).toContain('arrears');
    expect(result.toLowerCase()).toContain('not paid');
  });
});
