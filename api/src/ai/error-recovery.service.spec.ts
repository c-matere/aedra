import { ErrorRecoveryService } from './error-recovery.service';

describe('ErrorRecoveryService', () => {
  let service: ErrorRecoveryService;

  beforeEach(() => {
    service = new ErrorRecoveryService();
  });

  describe('buildInteractiveErrorRecovery', () => {
    it('should return text, options, and errorId', () => {
      const error = new Error('Test error');
      const result = service.buildInteractiveErrorRecovery(
        'default',
        error,
        { userId: 'user123' },
        'en',
      );

      expect(result.text).toContain('Something went wrong');
      expect(result.options).toHaveLength(1);
      expect(result.options[0].label).toBe('Why did it fail?');
      expect(result.options[0].action).toMatch(/^fail_reason:err_\d+_.+$/);
      expect(result.errorId).toBeDefined();
      expect(result.options[0].action).toContain(result.errorId);
    });

    it('should support Swahili', () => {
      const error = new Error('Test error');
      const result = service.buildInteractiveErrorRecovery(
        'default',
        error,
        { userId: 'user123' },
        'sw',
      );

      expect(result.text).toContain('Kuna tatizo');
      expect(result.options[0].label).toBe('Kwa nini imefeli?');
    });

    it('should handle 429 Rate Limit errors', () => {
      const error = new Error('429 Too Many Requests: Resource exhausted');
      const result = service.buildErrorRecovery(
        'any_action',
        error,
        { userId: 'u1' },
        'en',
      );
      expect(result).toContain('AI service is currently very busy');
    });

    it('should handle not implemented errors', () => {
      const error = new Error('Read tool some_tool not implemented');
      const result = service.buildErrorRecovery(
        'some_tool',
        error,
        { userId: 'u1' },
        'en',
      );
      expect(result).toContain('feature is currently being updated');
    });

    it('should return specific messages for get_payment_details', () => {
      const error = new Error('Database connection failed');
      const result = service.buildErrorRecovery(
        'get_payment_details',
        error,
        { userId: 'u1' },
        'en',
      );
      expect(result).toContain('retrieve those payment details');
    });

    it('should return busy message for fetch failures (network)', () => {
      const error = new Error('TypeError: fetch failed');
      const result = service.buildErrorRecovery(
        'default',
        error,
        { userId: 'u1' },
        'en',
      );
      expect(result).toContain('AI service is currently very busy');
    });

    it('should return busy message for timeout errors', () => {
      const error = new Error('The operation was aborted due to timeout');
      const result = service.buildErrorRecovery(
        'default',
        error,
        { userId: 'u1' },
        'en',
      );
      expect(result).toContain('AI service is currently very busy');
    });
  });
});
