import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';

export interface LockedState {
  lockedIntent: string | null;
  activeTenantId: string | null;
  activeTenantName: string | null;
  activePropertyId: string | null;
  activeUnitId: string | null;
  activeIssueId: string | null;
  executionHistory: string[]; // List of tools successfully executed
  turnCount: number;
  clearedAt: string | null;
}

export interface ActiveTransaction {
  amount?: number;
  currency?: string;
  date?: string;
  type?: string; // e.g. "LATE_PAYMENT", "PARTIAL_PAYMENT"
  confirmed?: boolean;
}

export interface SessionContext {
  activePropertyId?: string;
  activeTenantId?: string;
  activeUnitId?: string;
  activeCompanyId?: string;
  activeMaintenanceId?: string;
  activeTenant?: { id: string; name: string; unit?: string; arrears?: number; phone?: string };
  activeProperty?: { id: string; name: string; address?: string };
  activeIssue?: { id: string; type: string; status: string; unit?: string };
  activeTransaction?: ActiveTransaction;
  pendingAction?: string;
  lastIntent?: string;
  lastEntities?: Array<{ type: string; id: string; name: string }>;
  lastPriority?: string;
  lockedState?: LockedState;
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
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    this.logger.log(`[ContextMemory] Retrieved for ${uid}: lockedIntent=${parsed.lastIntent}`);
    return parsed;
  }

  async setContext(uid: string, context: Partial<SessionContext>): Promise<void> {
    const current = await this.getContext(uid);
    // LAYER 4: State Locking - Prevent overwriting a locked intent with undefined
    if (current.lastIntent && context.lastIntent === undefined) {
      context.lastIntent = current.lastIntent;
    }
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
      if (entity.type === 'property') {
        context.activePropertyId = entity.id;
        context.activeProperty = { id: entity.id, name: entity.name || 'Property' };
      }
      if (entity.type === 'tenant') {
        context.activeTenantId = entity.id;
        context.activeTenant = { id: entity.id, name: entity.name || 'Tenant' };
      }
      if (entity.type === 'unit') {
        context.activeUnitId = entity.id;
      }
      if (entity.type === 'company') context.activeCompanyId = entity.id;
      if (entity.type === 'maintenance') {
        context.activeMaintenanceId = entity.id;
        context.activeIssue = { id: entity.id, type: 'MAINTENANCE', status: 'PENDING' };
      }
    }

    if (Object.keys(context).length > 0) {
      this.logger.log(`[ContextMemory] Stitched entities for ${uid}: ${JSON.stringify(context)}`);
      await this.setContext(uid, context);
    }
  }

  async recordHistory(uid: string, toolName: string): Promise<void> {
    const context = await this.getContext(uid);
    const lockedState = context.lockedState || {
      lockedIntent: null,
      activeTenantId: null,
      activeTenantName: null,
      activePropertyId: null,
      activeUnitId: null,
      activeIssueId: null,
      executionHistory: [],
      turnCount: 0,
      clearedAt: null,
    };
    
    if (!lockedState.executionHistory) lockedState.executionHistory = [];
    lockedState.executionHistory.push(toolName);
    
    await this.setContext(uid, { lockedState });
  }

  /**
   * Clear context for a user
   */
  async clear(uid: string): Promise<void> {
    await this.cache.del(this.key(uid));
  }
}
