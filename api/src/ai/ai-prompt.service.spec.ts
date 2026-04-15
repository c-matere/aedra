import { AiPromptService } from './ai-prompt.service';
import { UserRole } from '../auth/roles.enum';
import { AiIntent } from './ai-contracts.types';

describe('AiPromptService.generateUnifiedPlan', () => {
  const makeService = () => {
    const prisma: any = {};
    const genAI: any = {};
    const groq: any = {};
    const toolRegistry: any = { getToolsForRole: jest.fn(async () => []) };
    return {
      service: new AiPromptService(prisma, genAI, groq, toolRegistry),
      toolRegistry,
    };
  };

  it('repairs invalid JSON output using the same model', async () => {
    const { service, toolRegistry } = makeService();

    const callModel = jest.spyOn(service as any, 'callModel');
    callModel.mockResolvedValueOnce('not json').mockResolvedValueOnce(
      JSON.stringify({
        intent: AiIntent.GENERAL_QUERY,
        priority: 'NORMAL',
        language: 'en',
        immediateResponse: 'ok',
        entities: {},
        steps: [{ tool: 'get_unit_details', args: {}, required: false }],
        planReasoning: '',
      }),
    );

    const plan = await service.generateUnifiedPlan(
      'hello',
      UserRole.COMPANY_STAFF,
      { companyId: 'bench-company-001' },
      [],
    );

    expect(toolRegistry.getToolsForRole).toHaveBeenCalled();
    expect(plan.intent).toBe(AiIntent.GENERAL_QUERY);
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].tool).toBe('get_unit_details');
    expect(callModel).toHaveBeenCalledTimes(2);
  });

  it('returns a safe fallback plan when the LLM call fails', async () => {
    const { service } = makeService();
    jest
      .spyOn(service as any, 'callModel')
      .mockRejectedValueOnce(new Error('fetch failed'));

    const plan = await service.generateUnifiedPlan(
      'hello',
      UserRole.COMPANY_STAFF,
      { companyId: 'bench-company-001' },
      [],
    );

    expect(plan.intent).toBe(AiIntent.GENERAL_QUERY);
    expect(plan.steps).toHaveLength(0);
    expect(plan.immediateResponse).toMatch(/technical issue/i);
  });

  it('generates takeover advice with suggestions-only JSON', async () => {
    const { service, toolRegistry } = makeService();
    toolRegistry.getToolsForRole.mockResolvedValue([
      'get_financial_report',
      'get_portfolio_arrears',
    ]);

    jest.spyOn(service as any, 'callModel').mockResolvedValueOnce(
      JSON.stringify({
        text: 'The summary is brief. Should I generate a full report?',
        suggestions: [
          {
            label: 'Full report',
            tool: 'get_financial_report',
            args: { range: 'last_30_days' },
          },
        ],
      }),
    );

    const advice = await service.generateTakeoverAdvice(
      {
        userMessage: 'check rent collection',
        role: UserRole.SUPER_ADMIN,
        language: 'en',
        context: { companyId: 'bench-company-001', activePropertyId: 'p1' },
        lastAction: { name: 'get_financial_summary' },
        lastResult: {
          totals: { payments: 200000 },
          breakdown: { payments: [] },
        },
        formattedText: 'Payments: 200,000',
      },
      [],
    );

    expect(advice.text).toMatch(/summary is brief/i);
    expect(advice.suggestions).toHaveLength(1);
    expect(advice.suggestions[0].tool).toBe('get_financial_report');
  });
});
