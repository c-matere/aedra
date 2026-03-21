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
  });
});
