import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';

export interface SessionContext {
  activePropertyId?: string;
  activeTenantId?: string;
  activeUnitId?: string;
  activeCompanyId?: string;
  activeMaintenanceId?: string;
  activeTenant?: { id: string; name: string; unit?: string; arrears?: number };
  activeIssue?: { id: string; type: string; status: string; unit?: string };
  pendingAction?: string;
  lastIntent?: string;
  lastEntities?: Array<{ type: string; id: string; name: string }>;
  updatedAt: number;
}

@Injectable()
export class ContextMemoryService {
  private readonly logger = new Logger(ContextMemoryService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly prisma: PrismaService,
  ) {}

  private key(uid: string): string {
    return `ai_context:${uid}`;
  }

  async getContext(uid: string): Promise<SessionContext> {
    const raw = await this.cache.get<string>(this.key(uid));
    if (!raw) {
      return { updatedAt: Date.now() };
    }
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  }

  async setContext(uid: string, context: Partial<SessionContext>): Promise<void> {
    const current = await this.getContext(uid);
    const updated = {
      ...current,
      ...context,
      updatedAt: Date.now(),
    };
    await this.cache.set(this.key(uid), updated, 3600 * 1000); // 1 hour TTL
  }

  /**
   * Resolve entities from a list of tool results or message content
   */
  async stitch(uid: string, entities: Array<{ type: string; id: string; name?: string }>): Promise<void> {
    const context: Partial<SessionContext> = {};
    
    for (const entity of entities) {
      if (entity.type === 'property') context.activePropertyId = entity.id;
      if (entity.type === 'tenant') context.activeTenantId = entity.id;
      if (entity.type === 'unit') context.activeUnitId = entity.id;
      if (entity.type === 'company') context.activeCompanyId = entity.id;
      if (entity.type === 'maintenance') context.activeMaintenanceId = entity.id;
    }

    if (Object.keys(context).length > 0) {
      this.logger.log(`[ContextMemory] Stitched entities for ${uid}: ${JSON.stringify(context)}`);
      await this.setContext(uid, context);
    }
  }

  /**
   * Clear context for a user
   */
  async clear(uid: string): Promise<void> {
    await this.cache.del(this.key(uid));
  }
}
