import { evaluateTakeover } from './takeover-policy.util';

describe('evaluateTakeover', () => {
  it('triggers takeover on tool error', () => {
    const res = evaluateTakeover({
      success: false,
      action: 'get_financial_report',
      data: {},
      error: 'FAIL',
    } as any);
    expect(res.shouldTakeover).toBe(true);
    expect(res.reason).toBe('TOOL_ERROR');
  });

  it('triggers takeover on requires_clarification', () => {
    const res = evaluateTakeover({
      success: false,
      action: 'search_tenants',
      data: { requires_clarification: true, message: 'Need query' },
    } as any);
    expect(res.shouldTakeover).toBe(true);
    expect(res.reason).toBe('REQUIRES_CLARIFICATION');
  });

  it('triggers takeover when totals exist but breakdown is empty', () => {
    const res = evaluateTakeover(
      {
        success: true,
        action: 'get_financial_report',
        data: {
          totals: { payments: 200000, expenses: 0, invoices: 0 },
          breakdown: { payments: [], expenses: [], invoices: [] },
        },
      } as any,
      { formattedText: 'Ok' },
    );
    expect(res.shouldTakeover).toBe(true);
    expect(res.reason).toBe('TOO_SIMPLE');
  });

  it('does not trigger takeover for normal successful action', () => {
    const res = evaluateTakeover({
      success: true,
      action: 'get_tenant_arrears',
      data: { arrears: 0 },
    } as any);
    expect(res.shouldTakeover).toBe(false);
  });
});
