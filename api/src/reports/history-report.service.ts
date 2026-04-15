import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';

export interface EntityChange {
  id: string;
  timestamp: Date;
  action: string;
  actor: {
    id: string;
    role: string;
  };
  diff: Record<string, { old: any; new: any }>;
}

@Injectable()
export class HistoryReportService {
  private readonly logger = new Logger(HistoryReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async getEntityHistory(
    entity: string,
    targetId: string,
  ): Promise<EntityChange[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        entity,
        targetId,
      },
      orderBy: { timestamp: 'desc' },
    });

    return logs.map((log) => ({
      id: log.id,
      timestamp: log.timestamp,
      action: log.action,
      actor: {
        id: log.actorId || 'SYSTEM',
        role: log.actorRole || 'SYSTEM',
      },
      diff: (log.metadata as any)?.diff || {},
    }));
  }

  async getChronology(companyId: string, limit = 50): Promise<EntityChange[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        actorCompanyId: companyId,
        action: { in: ['CREATE', 'UPDATE', 'DELETE'] },
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return logs.map((log) => ({
      id: log.id,
      timestamp: log.timestamp,
      action: `${log.action} ${log.entity}`,
      actor: {
        id: log.actorId || 'SYSTEM',
        role: log.actorRole || 'SYSTEM',
      },
      diff: (log.metadata as any)?.diff || {},
    }));
  }
}
