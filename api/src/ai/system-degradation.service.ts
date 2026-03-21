import { Injectable, Logger } from '@nestjs/common';

export type DegradationStatus =
  | 'HEALTHY'
  | 'DEGRADED_CACHE'
  | 'DEGRADED_LLM_FALLBACK';

@Injectable()
export class SystemDegradationService {
  private readonly logger = new Logger(SystemDegradationService.name);

  private currentStatus: DegradationStatus = 'HEALTHY';
  private lastDegradedAt: number = 0;

  // Auto-recover after 10 minutes (600,000 ms) of no reported errors
  private readonly RECOVERY_WINDOW_MS = 600000;

  reportDegradation(type: 'CACHE_DOWN' | 'GROQ_FAIL' | 'GEMINI_FAIL') {
    this.lastDegradedAt = Date.now();

    switch (type) {
      case 'CACHE_DOWN':
        if (this.currentStatus !== 'DEGRADED_CACHE') {
          this.logger.warn(
            `[SystemMode] Degradation detected: Redis cache unavailable. In-memory fallback active.`,
          );
          this.currentStatus = 'DEGRADED_CACHE';
        }
        break;
      case 'GROQ_FAIL':
      case 'GEMINI_FAIL':
        if (this.currentStatus !== 'DEGRADED_LLM_FALLBACK') {
          this.logger.warn(
            `[SystemMode] Degradation detected: Primary LLM API failure (${type}). Fallback active.`,
          );
          this.currentStatus = 'DEGRADED_LLM_FALLBACK';
        }
        break;
    }
  }

  private checkRecovery() {
    if (this.currentStatus === 'HEALTHY') return;

    if (Date.now() - this.lastDegradedAt > this.RECOVERY_WINDOW_MS) {
      this.logger.log(`[SystemMode] Auto-recovering to HEALTHY status.`);
      this.currentStatus = 'HEALTHY';
    }
  }

  getStatus(): DegradationStatus {
    this.checkRecovery();
    return this.currentStatus;
  }

  reset() {
    if (this.currentStatus !== 'HEALTHY') {
      this.logger.log(
        '[SystemMode] Resetting degradation status to HEALTHY after successful response.',
      );
      this.currentStatus = 'HEALTHY';
    }
  }

  getWarningBanner(language: string = 'en'): string {
    this.checkRecovery();

    if (this.currentStatus === 'HEALTHY') return '';

    const isSwahili = language.toLowerCase() === 'sw';

    if (this.currentStatus === 'DEGRADED_CACHE') {
      return isSwahili
        ? '⚠️ *Mtandao wa Aedra upo polepole kiasi kwa sasa.* Majibu yanaweza kuchukua muda mrefu kidogo.\n\n'
        : '⚠️ *Aedra is experiencing minor network delays.* Responses might be slightly slower than usual.\n\n';
    }

    if (this.currentStatus === 'DEGRADED_LLM_FALLBACK') {
      return isSwahili
        ? '⚠️ *Aedra inatumia mfumo wa dharura.* Baadhi ya vitendo (kama ripoti) huenda visipatikane.\n\n'
        : '⚠️ *Aedra is operating in fallback mode.* Some complex features (like reports) may be temporarily unavailable.\n\n';
    }

    return '';
  }
}
