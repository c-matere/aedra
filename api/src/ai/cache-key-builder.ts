import { Injectable } from '@nestjs/common';

export interface CacheKeyOptions {
  userId: string;
  intent?: string;
  companyId?: string;
  propertyId?: string;
  language?: string;
  message?: string;
}

@Injectable()
export class CacheKeyBuilder {
  build(options: CacheKeyOptions): string {
    if (!options.userId) {
      throw new Error('userId is required for cache key construction');
    }

    const { userId, intent, companyId, propertyId, language, message } = options;
    
    // BS-07: Privacy violation risk - sanitize and isolate
    const u = userId.replace(/[\s/\\]/g, '_');
    const c = (companyId || 'no-comp').replace(/[\s/\\]/g, '_');
    const p = (propertyId || 'no-prop').replace(/[\s/\\]/g, '_');
    const i = (intent || 'general').replace(/[\s/\\]/g, '_');
    const l = (language || 'en').replace(/[\s/\\]/g, '_');

    // If message is provided, add hash for granular caching
    let mHash = '';
    if (message) {
      mHash = Buffer.from(message).toString('base64').substring(0, 32).replace(/[+/=]/g, '');
    }

    const key = `ai_cache:${u}:${c}:${p}:${i}:${l}${mHash ? `:${mHash}` : ''}`;
    return key;
  }
}
