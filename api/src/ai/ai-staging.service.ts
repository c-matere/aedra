import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class AiStagingService {
  private readonly logger = new Logger(AiStagingService.name);
  private readonly STAGING_PREFIX = 'ai_staging_';
  private readonly DEFAULT_TTL = 1800000; // 30 minutes in ms

  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  /**
   * stage
   * Writes data to a job-specific staging area.
   */
  async stage(
    jobId: string,
    key: string,
    data: any,
    ttlMs?: number,
  ): Promise<string> {
    const stagingKey = this.getPrefix(jobId, key);
    await this.cacheManager.set(stagingKey, data, ttlMs ?? this.DEFAULT_TTL);
    this.logger.log(`[Staging] Staged data for job ${jobId} under key: ${key}`);
    return key;
  }

  /**
   * retrieve
   * Fetches data from staging.
   */
  async retrieve<T = any>(jobId: string, key: string): Promise<T | null> {
    const stagingKey = this.getPrefix(jobId, key);
    const result: any = await this.cacheManager.get<any>(stagingKey);
    if (result === undefined) return null;
    if (typeof result === 'string') {
      try {
        return JSON.parse(result) as T;
      } catch {
        // Some stores return raw strings (or already-serialized values). In that case,
        // return the original to avoid breaking callers expecting text.
        return result as unknown as T;
      }
    }
    return result as T;
  }

  /**
   * delete
   * Deletes a single staged key for a job.
   */
  async delete(jobId: string, key: string): Promise<void> {
    await this.cacheManager.del(this.getPrefix(jobId, key));
  }

  /**
   * inventory
   * Returns a list of all data keys currently staged for a specific job.
   */
  async inventory(jobId: string): Promise<string[]> {
    // Note: Generic cache-manager doesn't always support keys() or iteration.
    // For 'cache-manager-redis-yet', we might need to cast or use a specific strategy.
    // For now, we'll return an empty list or implement if the underlying cache supports it.
    try {
      const store = (this.cacheManager as any).store;
      if (store && typeof store.keys === 'function') {
        const allKeys = await store.keys(`${this.STAGING_PREFIX}${jobId}:*`);
        return allKeys.map((k: string) => k.split(':').pop());
      }
    } catch (e) {
      this.logger.warn(
        `Failed to list staging inventory for ${jobId}: ${e.message}`,
      );
    }
    return [];
  }

  /**
   * purge
   * Deletes all staged data for a job.
   */
  async purge(jobId: string): Promise<void> {
    const keys = await this.inventory(jobId);
    for (const key of keys) {
      await this.cacheManager.del(this.getPrefix(jobId, key));
    }
    this.logger.log(`[Staging] Purged all data for job: ${jobId}`);
  }

  private getPrefix(jobId: string, key: string): string {
    return `${this.STAGING_PREFIX}${jobId}:${key}`;
  }
}
