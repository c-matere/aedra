import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class AiQuotaService {
    private readonly logger = new Logger(AiQuotaService.name);
    private readonly DAILY_GROQ_LIMIT = 100000; // 100k tokens DTU for Groq free tier
    private readonly REMAINING_TOKEN_THRESHOLD = 5000; // Proactive buffer for Groq
    private readonly QUOTA_KEY_PREFIX = 'ai_quota_groq_';

    constructor(
        @Inject(CACHE_MANAGER)
        private readonly cacheManager: Cache,
    ) {}

    /**
     * getDailyKey
     * Generates a cache key for today's quota.
     */
    private getDailyKey(): string {
        const today = new Date().toISOString().split('T')[0];
        return `${this.QUOTA_KEY_PREFIX}${today}`;
    }

    /**
     * updateUsage
     * Records token usage for Groq.
     */
    async updateUsage(tokens: number): Promise<number> {
        const key = this.getDailyKey();
        const current = (await this.cacheManager.get<number>(key)) || 0;
        const total = current + tokens;
        
        // TTL for 24 hours to ensure cleanup
        await this.cacheManager.set(key, total, 86400000);
        
        this.logger.log(`[Quota] Groq usage updated: +${tokens}. Total today: ${total}/${this.DAILY_GROQ_LIMIT}`);
        return total;
    }

    /**
     * getRemainingTokens
     */
    async getRemainingTokens(): Promise<number> {
        const key = this.getDailyKey();
        const current = (await this.cacheManager.get<number>(key)) || 0;
        return Math.max(0, this.DAILY_GROQ_LIMIT - current);
    }

    /**
     * isQuotaExceeded
     * Returns true if the daily Groq limit has been reached.
     */
    async isQuotaExceeded(): Promise<boolean> {
        const key = this.getDailyKey();
        const current = (await this.cacheManager.get<number>(key)) || 0;
        
        // If it's explicitly locked (e.g. after a 429), return true immediately
        const locked = await this.cacheManager.get<boolean>(`${key}_locked`);
        if (locked) return true;

        return (current + this.REMAINING_TOKEN_THRESHOLD) >= this.DAILY_GROQ_LIMIT;
    }

    /**
     * forceQuotaExceeded
     * Manually locks the quota for the day (e.g. after a real 429).
     */
    async forceQuotaExceeded(): Promise<void> {
        const key = this.getDailyKey();
        this.logger.warn(`[Quota] System received a hard 429 from Groq. Locking Groq for the rest of the day.`);
        await this.cacheManager.set(`${key}_locked`, true, 86400000);
    }

    /**
     * getUsageStats
     */
    async getUsageStats() {
        const key = this.getDailyKey();
        const used = (await this.cacheManager.get<number>(key)) || 0;
        return {
            used,
            limit: this.DAILY_GROQ_LIMIT,
            remaining: Math.max(0, this.DAILY_GROQ_LIMIT - used),
            isExceeded: used >= this.DAILY_GROQ_LIMIT,
        };
    }
}
