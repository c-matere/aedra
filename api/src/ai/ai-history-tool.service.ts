import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HistoryReportService } from '../reports/history-report.service';
import { ReportsGeneratorService } from '../reports/reports-generator.service';
import { UserRole } from '../auth/roles.enum';
import { AuditLogService } from '../audit/audit-log.service';

@Injectable()
export class AiHistoryToolService {
  private readonly logger = new Logger(AiHistoryToolService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly historyService: HistoryReportService,
    private readonly reportsGenerator: ReportsGeneratorService,
    private readonly auditLog: AuditLogService,
  ) {}

  async executeHistoryTool(
    name: string,
    args: any,
    context: any,
    role: UserRole,
  ): Promise<any> {
    try {
      switch (name) {
        case 'view_version_history': {
          const { entity, targetId } = args;
          const history = await this.historyService.getEntityHistory(
            entity,
            targetId,
          );
          return {
            entity,
            targetId,
            history: history.slice(0, 10), // Return recent 10 to AI
            totalChanges: history.length,
          };
        }

        case 'view_portfolio_history': {
          const { entity, limit } = args;
          const logs = await this.auditLog.read({
            actorCompanyId: context.companyId,
            entity,
            limit: limit || 20,
          });
          return {
            companyId: context.companyId,
            entity,
            history: logs,
            totalChanges: logs.length,
          };
        }

        case 'generate_history_pdf': {
          const { entity, targetId, targetPhone } = args;
          const history = await this.historyService.getEntityHistory(
            entity,
            targetId,
          );
          if (history.length === 0) {
            return { error: 'No history found for this entity.' };
          }

          const fileName = `history_${entity.toLowerCase()}_${targetId}_${Date.now()}.pdf`;
          const url = await this.reportsGenerator.generateHistoryPdf(
            entity,
            targetId,
            history,
            fileName,
          );

          return {
            message: `Version control report generated successfully.`,
            url,
            note: 'The PDF has been generated and is ready for delivery.',
          };
        }

        case 'rollback_change': {
          const { auditLogId } = args;
          const log = await this.prisma.auditLog.findUnique({
            where: { id: auditLogId },
          });

          if (!log) throw new BadRequestException('Audit log entry not found.');
          if (!log.entity || !log.targetId) {
            throw new BadRequestException('Invalid audit log for rollback.');
          }

          // Map entity to prisma model
          const entityMap: Record<string, string> = {
            TENANT: 'tenant',
            LEASE: 'lease',
            PAYMENT: 'payment',
            UNIT: 'unit',
            PROPERTY: 'property',
            MAINTENANCE: 'maintenanceRequest',
            LANDLORD: 'landlord',
            STAFF: 'user',
            INVOICE: 'invoice',
            PENALTY: 'penalty',
            ARREARS: 'penalty',
          };
          const modelName = entityMap[log.entity] || log.entity.toLowerCase();
          const prismaModel = (this.prisma as any)[modelName];

          if (!prismaModel) {
            throw new BadRequestException(
              `Untrackable entity for rollback: ${log.entity}`,
            );
          }

          const before = (log.metadata as any)?.before;
          const after = (log.metadata as any)?.after;

          if (log.action === 'CREATE') {
            // Rolling back a CREATE = DELETE (Soft delete if possible, else hard)
            // Check if model has deletedAt
            const delegate = prismaModel;
            try {
              await delegate.update({
                where: { id: log.targetId },
                data: { deletedAt: new Date() },
              });
            } catch (e) {
              // Try hard delete if update fails (no deletedAt)
              await delegate.delete({
                where: { id: log.targetId },
              });
            }

            await this.auditLog.logEntityChange(
              log.entity,
              log.targetId,
              after,
              null,
              {
                actorId: context.userId,
                actorRole: role,
                actorCompanyId: context.companyId,
                method: 'ROLLBACK_DELETE',
              },
            );

            return {
              message: `Successfully rolled back CREATION of ${log.entity} by deleting it.`,
              entity: log.entity,
              targetId: log.targetId,
            };
          }

          if (!before) {
            throw new BadRequestException(
              'No previous state found in this audit log to rollback to.',
            );
          }

          // Dynamic prisma update for UPDATE/DELETE rollbacks
          const updated = await prismaModel.update({
            where: { id: log.targetId },
            data: before,
          });

          await this.auditLog.logEntityChange(
            log.entity,
            log.targetId,
            after,
            updated,
            {
              actorId: context.userId,
              actorRole: role,
              actorCompanyId: context.companyId,
              method: 'ROLLBACK',
            },
          );

          return {
            message: `Successfully rolled back ${log.entity} to state from ${log.timestamp.toLocaleString()}`,
            entity: log.entity,
            targetId: log.targetId,
          };
        }

        default:
          return { error: `History tool ${name} not implemented` };
      }
    } catch (error) {
      this.logger.error(
        `Error executing history tool ${name}: ${error.message}`,
      );
      return { error: `Failed to execute history operation: ${error.message}` };
    }
  }
}
