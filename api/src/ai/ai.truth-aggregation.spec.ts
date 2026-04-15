import { AiService } from './ai.service';
import { UserRole } from '../auth/roles.enum';
import { AiIntent } from './ai-contracts.types';

describe('AiService Truth Aggregation', () => {
  it('picks report URL deterministically (prefer generate_report_file)', async () => {
    const ai: any = {
      logger: {
        log: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    };

    const trace: any = {
      role: UserRole.COMPANY_STAFF,
      unifiedPlan: {
        intent: AiIntent.FINANCIAL_REPORTING,
        entities: {},
        steps: [],
      },
      steps: [
        {
          tool: 'download_report',
          success: true,
          result: {
            artifacts: [
              {
                kind: 'report',
                url: 'https://example.com/old.pdf',
                fileName: 'old.pdf',
                format: 'pdf',
              },
            ],
          },
        },
        {
          tool: 'some_other_tool',
          success: true,
          result: { url: 'https://example.com/aux.pdf' },
        },
        {
          tool: 'generate_report_file',
          success: true,
          result: {
            artifacts: [
              {
                kind: 'report',
                url: 'https://example.com/new.pdf',
                fileName: 'new.pdf',
                format: 'pdf',
              },
            ],
          },
        },
      ],
    };

    const truth = await (AiService.prototype as any).aggregateTruth.call(
      ai,
      trace,
      { role: UserRole.COMPANY_STAFF },
      {},
      {},
    );

    expect(truth.data.reportUrl).toBe('https://example.com/new.pdf');
    expect(truth.data.downloadLink).toBe('https://example.com/new.pdf');
  });
});
