import {
  normalizeToolErrorShape,
  normalizeToolStringShape,
} from './ai-tool-error-normalizer';

describe('normalizeToolErrorShape', () => {
  it('marks prerequisite errors as requires_clarification', () => {
    const raw = {
      error: 'BLOCK_PREREQUISITE_MISSING',
      message: 'Need property or unit.',
    };
    const normalized = normalizeToolErrorShape(raw);
    expect(normalized.error).toBe('BLOCK_PREREQUISITE_MISSING');
    expect(normalized.requires_clarification).toBe(true);
  });

  it('marks required_action errors as requires_clarification and extracts options', () => {
    const raw = {
      error: 'AMBIGUOUS_MATCH',
      required_action: 'SELECT_FROM_LIST',
      matches: [{ id: 'u1', label: 'Unit 1' }],
    };
    const normalized = normalizeToolErrorShape(raw);
    expect(normalized.error).toBe('AMBIGUOUS_MATCH');
    expect(normalized.requires_clarification).toBe(true);
    expect(normalized.options).toEqual([{ id: 'u1', label: 'Unit 1' }]);
  });

  it('normalizes CRITICAL_BLOCK strings into blocked results', () => {
    const normalized = normalizeToolStringShape(
      'CRITICAL_BLOCK: Registration not allowed. Missing active plan.',
    );
    expect(normalized.isBlocked).toBe(true);
    if (normalized.isBlocked) {
      expect(normalized.error).toBe('CRITICAL_BLOCK');
      expect(normalized.requires_clarification).toBe(true);
      expect(normalized.message).toContain('Registration not allowed');
      expect(normalized.message).not.toMatch(/^CRITICAL_BLOCK/i);
    }
  });
});
