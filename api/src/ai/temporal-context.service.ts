import { Injectable } from '@nestjs/common';

export interface TemporalContext {
  currentMonth: string;
  billingCycleStart: string;
  billingCycleEnd: string;
  daysUntilCycleEnd: number;
  snapshotTimestamp: number;
}

@Injectable()
export class TemporalContextService {
  /**
   * Builds context for the current time.
   * Note: Assumes EAT (UTC+3) for billing cycles.
   */
  buildTemporalContext(): TemporalContext {
    const now = new Date();
    // Offset for EAT if needed, but JS Date uses system time.
    // In production, we ensure server runs in EAT or we offset.
    
    return this.buildFromDate(now);
  }

  buildJobTemporalContext(): TemporalContext {
    return this.buildTemporalContext();
  }

  private buildFromDate(date: Date): TemporalContext {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed
    const pad = (n: number) => String(n).padStart(2, '0');
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Avoid timezone drift by constructing ISO-looking strings manually
    const billingCycleStart = `${year}-${pad(month + 1)}-01`;
    const billingCycleEnd = `${year}-${pad(month + 1)}-${pad(daysInMonth)}`;

    const monthName = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const endOfMonth = new Date(year, month, daysInMonth, 23, 59, 59, 999);
    const diff = endOfMonth.getTime() - date.getTime();
    const daysUntilEnd = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));

    return {
      currentMonth: monthName,
      billingCycleStart,
      billingCycleEnd,
      daysUntilCycleEnd: daysUntilEnd,
      snapshotTimestamp: date.getTime()
    };
  }
}
