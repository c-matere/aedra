import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export type AuditAction =
  | 'CREATE'
  | 'READ'
  | 'UPDATE'
  | 'DELETE'
  | 'AUTH'
  | 'SYSTEM';
export type AuditOutcome = 'SUCCESS' | 'FAILURE';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: AuditAction;
  outcome: AuditOutcome;
  method: string;
  path: string;
  entity?: string;
  targetId?: string;
  actorId?: string;
  actorRole?: string;
  actorCompanyId?: string;
  statusCode?: number;
  durationMs?: number;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogFilter {
  limit?: number;
  action?: AuditAction;
  outcome?: AuditOutcome;
  entity?: string;
  actorId?: string;
  actorCompanyId?: string;
  targetId?: string;
}

const REDACTED_KEYS = new Set([
  'password',
  'token',
  'accessToken',
  'authorization',
  'cookie',
  'secret',
]);

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);
  private readonly entries: AuditLogEntry[] = [];
  private readonly maxEntries: number;

  constructor(private readonly prisma: PrismaService) {
    const configured = Number(process.env.AUDIT_LOG_MAX_ENTRIES ?? '5000');
    this.maxEntries =
      Number.isFinite(configured) && configured > 0 ? configured : 5000;
  }

  async write(
    entry: Omit<AuditLogEntry, 'id' | 'timestamp'>,
  ): Promise<AuditLogEntry> {
    const record: AuditLogEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      ...entry,
      metadata: this.sanitize(entry.metadata) as
        | Record<string, unknown>
        | undefined,
    };

    this.entries.unshift(record);
    if (this.entries.length > this.maxEntries) {
      this.entries.length = this.maxEntries;
    }

    const rendered = JSON.stringify(record);
    if (record.outcome === 'SUCCESS') {
      this.logger.log(rendered);
    } else {
      this.logger.warn(rendered);
    }

    try {
      await this.prisma.auditLog.create({
        data: {
          id: record.id,
          timestamp: new Date(record.timestamp),
          action: record.action,
          outcome: record.outcome,
          method: record.method,
          path: record.path,
          entity: record.entity,
          targetId: record.targetId,
          actorId: record.actorId,
          actorRole: record.actorRole,
          actorCompanyId: record.actorCompanyId,
          statusCode: record.statusCode,
          durationMs: record.durationMs,
          ip: record.ip,
          userAgent: record.userAgent,
          requestId: record.requestId,
          metadata: record.metadata as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to persist audit log: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return record;
  }

  async logEntityChange(
    entity: string,
    targetId: string,
    before: Record<string, any> | null,
    after: Record<string, any> | null,
    context: {
      actorId?: string;
      actorRole?: string;
      actorCompanyId?: string;
      path?: string;
      method?: string;
      requestId?: string;
      entitySummary?: string;
    },
  ): Promise<AuditLogEntry> {
    const diff = this.calculateDiff(before, after);
    const metadata = {
      before: before ? this.sanitize(before) : null,
      after: after ? this.sanitize(after) : null,
      diff,
      entitySummary: context.entitySummary,
    };

    return this.write({
      action: before ? (after ? 'UPDATE' : 'DELETE') : 'CREATE',
      outcome: 'SUCCESS',
      method: context.method || 'INTERNAL',
      path: context.path || 'system',
      entity,
      targetId,
      actorId: context.actorId,
      actorRole: context.actorRole,
      actorCompanyId: context.actorCompanyId,
      requestId: context.requestId,
      metadata,
    });
  }

  /**
   * Build a concise version-control summary to embed in write tool responses.
   * The AI reads this and is instructed to surface it to the user after every mutation.
   */
  buildVcSummary(logEntry: AuditLogEntry): {
    versionId: string;
    action: string;
    changedFields: string[];
    hint: string;
  } {
    const diff = (logEntry.metadata?.diff ?? {}) as Record<
      string,
      { old: any; new: any }
    >;
    const changedFields = Object.keys(diff);
    const hint =
      changedFields.length > 0
        ? `Changed: ${changedFields.join(', ')}.`
        : logEntry.action === 'CREATE'
          ? 'New record created.'
          : logEntry.action === 'DELETE'
            ? 'Record deleted.'
            : 'No field-level changes detected.';

    return {
      versionId: logEntry.id,
      action: logEntry.action,
      changedFields,
      hint,
    };
  }

  private calculateDiff(
    before: Record<string, any> | null,
    after: Record<string, any> | null,
  ): Record<string, { old: any; new: any }> {
    if (!before || !after) return {};
    const diff: Record<string, { old: any; new: any }> = {};
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const key of keys) {
      if (['updatedAt', 'createdAt', 'id', 'deletedAt'].includes(key)) continue;
      const oldVal = before[key];
      const newVal = after[key];

      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        diff[key] = { old: oldVal, new: newVal };
      }
    }
    return diff;
  }

  async read(filter: AuditLogFilter = {}): Promise<AuditLogEntry[]> {
    const limit = this.resolveLimit(filter.limit);

    try {
      const rows = await this.prisma.auditLog.findMany({
        where: {
          action: filter.action,
          outcome: filter.outcome,
          entity: filter.entity,
          actorId: filter.actorId,
          actorCompanyId: filter.actorCompanyId,
          targetId: filter.targetId,
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });

      return rows.map((row) => ({
        id: row.id,
        timestamp: row.timestamp.toISOString(),
        action: row.action as AuditAction,
        outcome: row.outcome as AuditOutcome,
        method: row.method,
        path: row.path,
        entity: row.entity ?? undefined,
        targetId: row.targetId ?? undefined,
        actorId: row.actorId ?? undefined,
        actorRole: row.actorRole ?? undefined,
        actorCompanyId: row.actorCompanyId ?? undefined,
        statusCode: row.statusCode ?? undefined,
        durationMs: row.durationMs ?? undefined,
        ip: row.ip ?? undefined,
        userAgent: row.userAgent ?? undefined,
        requestId: row.requestId ?? undefined,
        metadata:
          row.metadata && typeof row.metadata === 'object'
            ? (row.metadata as Record<string, unknown>)
            : undefined,
      }));
    } catch (error) {
      this.logger.warn(
        `Reading persisted audit logs failed, using memory fallback: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return this.entries
        .filter((entry) =>
          filter.action ? entry.action === filter.action : true,
        )
        .filter((entry) =>
          filter.outcome ? entry.outcome === filter.outcome : true,
        )
        .filter((entry) =>
          filter.entity ? entry.entity === filter.entity : true,
        )
        .filter((entry) =>
          filter.actorId ? entry.actorId === filter.actorId : true,
        )
        .filter((entry) =>
          filter.actorCompanyId
            ? entry.actorCompanyId === filter.actorCompanyId
            : true,
        )
        .filter((entry) =>
          filter.targetId ? entry.targetId === filter.targetId : true,
        )
        .slice(0, limit);
    }
  }

  private resolveLimit(limit?: number): number {
    if (!limit || Number.isNaN(limit)) {
      return 200;
    }

    return Math.min(Math.max(limit, 1), this.maxEntries);
  }

  private sanitize(value: unknown, depth = 0): unknown {
    if (value == null || depth > 5) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item, depth + 1));
    }

    if (typeof value === 'object') {
      const output: Record<string, unknown> = {};
      for (const [key, nestedValue] of Object.entries(value)) {
        if (REDACTED_KEYS.has(key)) {
          output[key] = '[REDACTED]';
          continue;
        }

        output[key] = this.sanitize(nestedValue, depth + 1);
      }
      return output;
    }

    if (typeof value === 'string' && value.length > 2000) {
      return `${value.slice(0, 2000)}...[truncated]`;
    }

    return value;
  }
}
