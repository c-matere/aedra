import { normalizeEnum, validateEnum } from './ai.validation';

describe('ai.validation', () => {
  it('normalizes enum values', () => {
    expect(normalizeEnum('in progress')).toBe('IN_PROGRESS');
    expect(normalizeEnum('bank-transfer')).toBe('BANK_TRANSFER');
  });

  it('validates allowed enums', () => {
    const allowed = ['A', 'B', 'IN_PROGRESS'];
    expect(validateEnum('in progress', allowed, 'status')).toBe('IN_PROGRESS');
    expect(validateEnum('C', allowed, 'status')).toEqual({
      error: 'status must be one of: A, B, IN_PROGRESS',
    });
  });
});
