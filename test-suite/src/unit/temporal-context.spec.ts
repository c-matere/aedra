import { Test, TestingModule } from '@nestjs/testing';
import { TemporalContextService } from '../../../api/src/ai/temporal-context.service';

describe('TemporalContextService', () => {
  let service: TemporalContextService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TemporalContextService],
    }).compile();

    service = module.get<TemporalContextService>(TemporalContextService);
  });

  describe('buildTemporalContext', () => {
    it('returns a valid temporal context for the current time', () => {
      const context = service.buildTemporalContext();
      
      expect(context).toHaveProperty('currentMonth');
      expect(context).toHaveProperty('billingCycleStart');
      expect(context).toHaveProperty('billingCycleEnd');
      expect(context).toHaveProperty('daysUntilCycleEnd');
      expect(context).toHaveProperty('snapshotTimestamp');
      
      expect(typeof context.currentMonth).toBe('string');
      expect(context.billingCycleStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(context.billingCycleEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(context.daysUntilCycleEnd).toBeGreaterThanOrEqual(0);
    });
  });

  describe('buildJobTemporalContext', () => {
    it('returns a snapshot timestamp and consistent billing cycle', () => {
      const context = service.buildJobTemporalContext();
      
      expect(context.snapshotTimestamp).toBeLessThanOrEqual(Date.now());
      // Billing cycle start should be first of some month
      expect(context.billingCycleStart.endsWith('-01')).toBe(true);
    });
  });
});
