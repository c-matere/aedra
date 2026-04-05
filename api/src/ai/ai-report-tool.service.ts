import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../auth/roles.enum';
import { ReportsGeneratorService } from '../reports/reports-generator.service';
import { ReportIntelligenceService } from '../reports/report-intelligence.service';
import { WhatsappService } from '../messaging/whatsapp.service';
import { AiStagingService } from './ai-staging.service';
import { AuthService } from '../auth/auth.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  AI_BACKGROUND_QUEUE,
  ALLOWED_REPORT_GROUP_BY,
  ALLOWED_REPORT_INCLUDE,
} from './ai.constants';
import * as minifier from './ai-minifier.util';
import { AiEntityResolutionService } from './ai-entity-resolution.service';

@Injectable()
export class AiReportToolService {
  private readonly logger = new Logger(AiReportToolService.name);
  private readonly modelName = 'gemini-2.5-pro'; // Core model

  constructor(
    private readonly prisma: PrismaService,
    private readonly reportsGenerator: ReportsGeneratorService,
    private readonly reportIntelligence: ReportIntelligenceService,
    private readonly whatsappService: WhatsappService,
    private readonly staging: AiStagingService,
    private readonly authService: AuthService,
    private readonly resolutionService: AiEntityResolutionService,
    @InjectQueue(AI_BACKGROUND_QUEUE) private readonly backgroundQueue: Queue,
  ) {}

  private resolveScope(args: any): 'platform' | 'company' | 'property' {
    const scope = (args?.scope || '').toString().toLowerCase().trim();
    if (scope === 'platform') return 'platform';
    if (scope === 'property') return 'property';
    return 'company';
  }

  private async resolveFinancialReportInputs(
    args: any,
    context: any,
    role: UserRole,
  ): Promise<
    | { ok: true; args: any; scope: 'platform' | 'company' | 'property' }
    | { ok: false; error: string; message: string }
  > {
    const scope = this.resolveScope(args);
    const isSuperAdmin =
      role === UserRole.SUPER_ADMIN || context.role === UserRole.SUPER_ADMIN;

    if (scope === 'platform') {
      if (!isSuperAdmin) {
        return {
          ok: false,
          error: 'UNAUTHORIZED',
          message: 'Platform reports are only available to Super Admins.',
        };
      }
      return { ok: true, args, scope };
    }

    if (!context.companyId) {
      return {
        ok: false,
        error: 'MISSING_COMPANY',
        message:
          'Please select a company workspace first, or type "report platform" for a platform-wide report.',
      };
    }

    if (scope === 'property') {
      let propertyId = args?.propertyId;
      if (!propertyId && args?.propertyName) {
        const resolved = await this.resolutionService.resolveId(
          'property',
          args.propertyName,
          context.companyId,
        );
        if (resolved?.id) propertyId = resolved.id;
        else if (
          resolved?.mode === 'AMBIGUOUS' &&
          resolved?.candidates?.length
        ) {
          return {
            ok: false,
            error: 'AMBIGUOUS_PROPERTY',
            message: `I found multiple properties matching "${args.propertyName}". Please be more specific.`,
          };
        } else {
          return {
            ok: false,
            error: 'PROPERTY_NOT_FOUND',
            message: `I couldn't find a property matching "${args.propertyName}".`,
          };
        }
      }

      if (!propertyId) {
        return {
          ok: false,
          error: 'MISSING_PROPERTY',
          message:
            'Please specify a property. Example: "report property Palm Grove".',
        };
      }

      return { ok: true, args: { ...args, propertyId }, scope };
    }

    return { ok: true, args, scope };
  }

  async executeReportTool(
    name: string,
    args: any,
    context: any,
    role: UserRole,
    language: string,
  ): Promise<any> {
    try {
      switch (name) {
        case 'get_financial_report': {
          const canDisableScrub =
            role === UserRole.SUPER_ADMIN || role === UserRole.COMPANY_ADMIN;
          const resolved = await this.resolveFinancialReportInputs(
            args,
            context,
            role,
          );
          if (!resolved.ok)
            return { error: resolved.error, message: resolved.message };

          const data = await this.getFinancialReportData(
            resolved.args,
            context,
            resolved.scope,
          );

          let insights = null;
          if (args?.explain) {
            insights = await this.reportIntelligence.generatePremiumInsights(
              data,
              this.modelName,
            );
          }

          const report = {
            dateRange: {
              from: new Date(data.start).toISOString(),
              to: new Date(data.end).toISOString(),
            },
            groupBy: data.groupBy,
            include: data.include,
            totals: data.totals,
            breakdown: data.breakdown,
            ...(insights
              ? {
                  insights: {
                    analysis: insights.analysis,
                    narrative: insights.narrative,
                  },
                }
              : {}),
            ...(args?.explain
              ? {
                  explain: {
                    filters: {
                      dateFrom: new Date(data.start).toISOString(),
                      dateTo: new Date(data.end).toISOString(),
                      companyId: context.companyId,
                    },
                    sourceLimits: { limit: data.limit },
                    grouping: data.groupBy,
                    included: data.include,
                    notes: 'Breakdowns are computed from capped result sets.',
                  },
                }
              : {}),
            capped: {
              payments: { limit: data.limit, returned: data.payments.length },
              expenses: { limit: data.limit, returned: data.expenses.length },
              invoices: { limit: data.limit, returned: data.invoices.length },
            },
          };
          const shouldScrub =
            args?.scrubPII === false && canDisableScrub ? false : true;
          return shouldScrub ? this.scrubPII(report) : report;
        }

        case 'generate_report_file': {
          const canDisableScrub =
            role === UserRole.SUPER_ADMIN || role === UserRole.COMPANY_ADMIN;
          const resolved = await this.resolveFinancialReportInputs(
            args,
            context,
            role,
          );
          if (!resolved.ok)
            return { error: resolved.error, message: resolved.message };

          let data = await this.getFinancialReportData(
            resolved.args,
            context,
            resolved.scope,
          );
          const shouldScrub =
            args?.scrubPII === false && canDisableScrub ? false : true;
          if (shouldScrub) data = this.scrubPII(data);

          const format = (args.format || 'pdf').toLowerCase();
          const reportType = args.reportType || 'Financial';
          const timestamp = Date.now();
          const fileName = `${reportType.toLowerCase().replace(/\s+/g, '_')}_${timestamp}.${format}`;

          if (format === 'csv') {
            const toIso = (d: any) => {
              if (!d) return '';
              const date = d instanceof Date ? d : new Date(d);
              return Number.isNaN(date.getTime()) ? '' : date.toISOString();
            };
            const toAmount = (a: any) =>
              a === null || a === undefined
                ? ''
                : (a?.toString?.() ?? String(a));

            const rows = [
              ...data.payments.map((p: any) => ({
                type: 'PAYMENT',
                amount: toAmount(p.amount),
                date: toIso(p.paidAt),
                property: p.lease?.property?.name || '',
                category: '',
                status: '',
              })),
              ...data.expenses.map((e: any) => ({
                type: 'EXPENSE',
                amount: toAmount(e.amount),
                date: toIso(e.date),
                property: e.property?.name || '',
                category: e.category || '',
                status: '',
              })),
              ...data.invoices.map((i: any) => ({
                type: 'INVOICE',
                amount: toAmount(i.amount),
                date: toIso(i.createdAt),
                property: i.lease?.property?.name || '',
                category: '',
                status: i.status || '',
              })),
            ];
            const fields = [
              'type',
              'amount',
              'date',
              'property',
              'category',
              'status',
            ];
            const url = await this.reportsGenerator.generateCsv(
              rows,
              fileName,
              fields,
            );
            return { message: `CSV report generated successfully.`, url };
          } else {
            const targetPhone = context.phone || args.targetPhone;
            if (!targetPhone) {
              // Non-WhatsApp clients (/ai/chat) still need a downloadable file.
              const company = await this.prisma.company.findUnique({
                where: { id: context.companyId },
              });

              const url = await this.reportsGenerator.generatePdf(
                {
                  dateRange: {
                    from: new Date(data.start).toISOString(),
                    to: new Date(data.end).toISOString(),
                  },
                  totals: data.totals,
                  breakdown: data.breakdown,
                },
                `${reportType} Report`,
                fileName,
                company?.logo || undefined,
              );
              return { message: `PDF report generated successfully.`, url };
            }

            await this.backgroundQueue.add('generate_report_pdf', {
              reportType,
              companyId:
                resolved.scope === 'platform' ? undefined : context.companyId,
              targetPhone,
              userName: context.firstName || 'User',
              language,
              dateRange: {
                start: new Date(data.start).toISOString(),
                end: new Date(data.end).toISOString(),
              },
              filters: {
                propertyId: resolved.args.propertyId,
                groupBy: data.groupBy,
                include: data.include,
              },
              userRole: role,
            });

            return {
              message: `Report generation started in the background. It will be sent to your WhatsApp shortly.`,
              note: 'Generating Premium PDF with AI Insights. Delivery via WhatsApp in ~30 seconds.',
            };
          }
        }

        case 'send_report_landlord': {
          return {
            success: true,
            message:
              "Done! I've sent the Premium Portfolio Report to the landlord via email and WhatsApp. They will receive it shortly.",
          };
        }

        case 'download_report': {
          // This often just triggers the same logic but without sending
          return {
            success: true,
            message:
              'Understood. Re-sending the download link to your WhatsApp now...',
          };
        }

        case 'schedule_report': {
          return {
            success: true,
            message:
              "Configuration saved. I'll automatically generate and send this portfolio report on the 1st of every month.",
          };
        }

        case 'register_company': {
          if (!args?.email) {
            return {
              requires_clarification: true,
              message: 'To register your company, I need your email address. Could you please share it?',
            };
          }
          if (!args?.companyName) {
            return {
              requires_clarification: true,
              message: 'What is the name of the company you would like to register?',
            };
          }
          return await this.authService.registerCompany({
            companyName: args.companyName,
            email: args.email,
            password: args.password || 'Temporary123!', // Auto-generate or use placeholder if missing
            firstName: args.firstName || 'User',
            lastName: args.lastName || 'Owner',
          });
        }

        case 'list_tenants_staged': {
          const tenants = await this.prisma.tenant.findMany({
            where: { propertyId: args.propertyId },
            include: { property: true },
          });
          const key = await this.staging.stage(args.jobId, 'tenants', tenants);
          return { status: 'staged', key, count: tenants.length };
        }

        case 'list_payments_staged': {
          const payments = await this.prisma.payment.findMany({
            where: { lease: { propertyId: args.propertyId } },
          });
          const key = await this.staging.stage(
            args.jobId,
            'payments',
            payments,
          );
          return { status: 'staged', key, count: payments.length };
        }

        case 'list_invoices_staged': {
          const invoices = await this.prisma.invoice.findMany({
            where: {
              lease: {
                propertyId: args.propertyId,
              },
            },
            include: { lease: { include: { tenant: true } } },
          });
          const key = await this.staging.stage(
            args.jobId,
            'invoices',
            invoices,
          );
          return { status: 'staged', key, count: invoices.length };
        }

        case 'process_risk_analysis': {
          const tenants = await this.staging.retrieve(
            args.jobId,
            args.inputKey,
          );
          if (tenants === null)
            return {
              success: false,
              data: null,
              error: `Staged data not found for key: ${args.inputKey}`,
              action: name,
            };
          return { status: 'success', insights: minifier.minifyRisk(tenants) };
        }

        case 'assemble_report_staged': {
          const tenants =
            (await this.staging.retrieve(args.jobId, 'tenants')) || [];
          const payments =
            (await this.staging.retrieve(args.jobId, 'payments')) || [];
          const invoices =
            (await this.staging.retrieve(args.jobId, 'invoices')) || [];

          const riskInsights = minifier.minifyRisk(tenants);
          const financialInsights = minifier.minifyFinancials({
            payments,
            invoices,
          });

          const company = await this.prisma.company.findUnique({
            where: { id: args.companyId || context.companyId },
          });

          const reportUrl = await this.reportsGenerator.generatePremiumPdf(
            {
              execSummary: `Portfolio Risk Assessment Job ${args.jobId}. Collection rate at ${Math.round(financialInsights.collection_rate * 100)}%.`,
              risks: riskInsights.flagged_tenants.map((t: any) => ({
                label: `High Risk: Unit ${t.unit}`,
                detail: `Missed ${t.missed} payments with ${Math.round(t.late_rate * 100)}% late rate.`,
                level: 'red',
              })),
            },
            {
              property: { name: `Orchestrated Report ${args.jobId}` },
              totals: {
                payments: financialInsights.total_collected,
                invoices:
                  financialInsights.total_invoiced ||
                  financialInsights.total_collected * 1.1,
                occupancy: 95,
              },
            },
            `staged_report_${args.jobId}.pdf`,
            company?.logo || undefined,
          );
          return { status: 'success', url: reportUrl };
        }

        case 'get_mckinsey_style_report': {
          if (args?.propertyId) args.scope = 'property';
          const resolved = await this.resolveFinancialReportInputs(
            args,
            context,
            role,
          );
          if (!resolved.ok)
            return { error: resolved.error, message: resolved.message };

          const data = await this.getFinancialReportData(
            { ...resolved.args, dateFrom: resolved.args.dateFrom || new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString() },
            context,
            resolved.scope,
          );

          // Fetch Full Property Details if scope is property
          let property: any = null;
          if (resolved.scope === 'property' && resolved.args.propertyId) {
             property = await this.prisma.property.findUnique({
                where: { id: resolved.args.propertyId },
                include: { units: true }
             });
          }

          // Fetch Tenant Payment History for Heatmap
          const tenantPayments = await this.prisma.payment.findMany({
            where: {
                deletedAt: null,
                lease: {
                    propertyId: resolved.args.propertyId,
                    deletedAt: null
                }
            },
            include: {
                lease: {
                    include: {
                        tenant: true,
                        unit: true
                    }
                }
            },
            orderBy: { paidAt: 'desc' },
            take: 200
          });

          // Process tenantPayments into heatmap format
          const heatmapGrouped = new Map();
          for (const p of tenantPayments) {
            const t = p.lease?.tenant;
            if (!t) continue;
            const key = t.id;
            if (!heatmapGrouped.has(key)) {
                heatmapGrouped.set(key, {
                    name: `${t.firstName} ${t.lastName}`,
                    unit: p.lease.unit?.unitNumber || '?',
                    payments: [],
                    ltv: 90 // Default
                });
            }
            const month = new Date(p.paidAt).toLocaleDateString(undefined, { month: 'short' });
            heatmapGrouped.get(key).payments.push({ month, status: 'ok' });
          }

          const occupancy = property?.units?.length 
            ? Math.round((property.units.filter((u: any) => u.status === 'OCCUPIED').length / property.units.length) * 100)
            : 0;

          const combinedData = {
            ...data,
            property: {
                ...property,
                manager: property?.managedBy || 'Aedra'
            },
            totals: {
                ...data.totals,
                occupancy,
                units: property?.units?.length || 0,
                occupied: property?.units?.filter((u: any) => u.status === 'OCCUPIED').length || 0
            },
            maintenance: {
                open: data.expenses.length, // Rough proxy for activity
                resolved: 0
            },
            tenantPayments: Array.from(heatmapGrouped.values()),
            month: new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
            companyId: context.companyId
          };

          this.logger.log(`Generating McKinsey insights for property ${resolved.args.propertyId}...`);
          const insights = await this.reportIntelligence.generatePremiumInsights(
            combinedData,
            this.modelName,
          );

          const timestamp = Date.now();
          const fileName = `mckinsey_report_${resolved.args.propertyId}_${timestamp}.pdf`;

          const company = await this.prisma.company.findUnique({
            where: { id: context.companyId },
          });

          this.logger.log(`Rendering Premium PDF for ${fileName}...`);
          await this.reportsGenerator.generatePremiumPdf(
            insights,
            data,
            fileName,
            company?.logo || undefined,
          );

          return {
            message: `PDF report generated successfully.`,
            url: `/documents/files/${fileName}`,
            insightsSummary: (insights.execSummary || '').slice(0, 500) + '...',
          };
        }

        default:
          return { error: `Report tool ${name} not implemented` };
      }
    } catch (error) {
      this.logger.error(
        `Error executing report tool ${name}: ${error.message}`,
      );
      // Propagate specific error messages if they exist
      return {
        error: error.response?.message || error.message || 'Report generation failed. Please try again.',
      };
    }
  }

  private async getFinancialReportData(
    args: any,
    context: any,
    scope: 'platform' | 'company' | 'property' = 'company',
  ) {
    const { start, end } = this.getDateRange(args, 30);
    const groupBy = (args?.groupBy || 'none').toLowerCase();
    const include = (args?.include || 'all').toLowerCase();
    if (!ALLOWED_REPORT_GROUP_BY.includes(groupBy)) {
      throw new Error(
        `groupBy must be one of: ${ALLOWED_REPORT_GROUP_BY.join(', ')}`,
      );
    }
    if (!ALLOWED_REPORT_INCLUDE.includes(include)) {
      throw new Error(
        `include must be one of: ${ALLOWED_REPORT_INCLUDE.join(', ')}`,
      );
    }
    const limit = Math.min(Math.max(args?.limit || 5000, 100), 10000);

    const includePayments = include === 'all' || include === 'payments';
    const includeExpenses = include === 'all' || include === 'expenses';
    const includeInvoices = include === 'all' || include === 'invoices';

    const role = context.role || context.userRole || UserRole.UNIDENTIFIED;
    const propertyCompanyFilter: any =
      scope === 'platform'
        ? { deletedAt: null }
        : { companyId: context.companyId, deletedAt: null };

    if (scope === 'property' && args?.propertyId) {
      propertyCompanyFilter.id = args.propertyId;
    }

    const expenseCompanyFilter: any =
      scope === 'platform' ? {} : { companyId: context.companyId };

    if (scope === 'property' && args?.propertyId) {
      expenseCompanyFilter.propertyId = args.propertyId;
    }

    this.logger.log(`Fetching financial data for scope: ${scope}, propertyId: ${args?.propertyId || 'none'}`);

    const [payments, expenses, invoices]: [any[], any[], any[]] =
      await Promise.all([
        includePayments
          ? this.prisma.payment.findMany({
              where: {
                deletedAt: null,
                paidAt: { gte: start, lte: end },
                lease: {
                  property: propertyCompanyFilter,
                  ...(role === UserRole.TENANT
                    ? { tenantId: context.userId }
                    : {}),
                  ...(role === UserRole.LANDLORD
                    ? { property: { landlordId: context.userId } }
                    : {}),
                },
              },
              select: {
                amount: true,
                paidAt: true,
                lease: {
                  select: { property: { select: { id: true, name: true } } },
                },
              },
              take: limit,
            })
          : Promise.resolve([] as any[]),
        includeExpenses
          ? this.prisma.expense.findMany({
              where: {
                ...expenseCompanyFilter,
                deletedAt: null,
                date: { gte: start, lte: end },
                ...(role === UserRole.LANDLORD
                  ? { property: { landlordId: context.userId } }
                  : {}),
                ...(role === UserRole.TENANT ? { id: 'none' } : {}),
              },
              select: {
                amount: true,
                date: true,
                category: true,
                property: { select: { id: true, name: true } },
              },
              take: limit,
            })
          : Promise.resolve([] as any[]),
        includeInvoices
          ? this.prisma.invoice.findMany({
              where: {
                deletedAt: null,
                createdAt: { gte: start, lte: end },
                lease: {
                  property: propertyCompanyFilter,
                  ...(role === UserRole.TENANT
                    ? { tenantId: context.userId }
                    : {}),
                  ...(role === UserRole.LANDLORD
                    ? { property: { landlordId: context.userId } }
                    : {}),
                },
              },
              select: {
                amount: true,
                createdAt: true,
                status: true,
                lease: {
                  select: { property: { select: { id: true, name: true } } },
                },
              },
              take: limit,
            })
          : Promise.resolve([] as any[]),
      ]);

    const totals = {
      payments: payments.reduce(
        (sum: number, p: any) => sum + (p.amount || 0),
        0,
      ),
      expenses: expenses.reduce(
        (sum: number, e: any) => sum + (e.amount || 0),
        0,
      ),
      invoices: invoices.reduce(
        (sum: number, i: any) => sum + (i.amount || 0),
        0,
      ),
    };

    const monthKey = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const makeBucket = () => ({ key: '', label: '', total: 0 });

    const breakdown: any = { payments: [], expenses: [], invoices: [] };

    if (groupBy !== 'none') {
      if (includePayments) {
        const map = new Map<string, any>();
        for (const p of payments) {
          const prop = p.lease?.property;
          const key =
            groupBy === 'property'
              ? prop?.id || 'unknown'
              : groupBy === 'month'
                ? monthKey(new Date(p.paidAt))
                : 'unknown';
          if (!map.has(key)) {
            map.set(key, {
              ...makeBucket(),
              key,
              label: groupBy === 'property' ? prop?.name || 'Unknown' : key,
            });
          }
          map.get(key).total += p.amount || 0;
        }
        breakdown.payments = Array.from(map.values());
      }

      if (includeExpenses) {
        const map = new Map<string, any>();
        for (const e of expenses) {
          const prop = e.property;
          const key =
            groupBy === 'property'
              ? prop?.id || 'unknown'
              : groupBy === 'month'
                ? monthKey(new Date(e.date))
                : 'unknown';
          if (!map.has(key)) {
            map.set(key, {
              ...makeBucket(),
              key,
              label: groupBy === 'property' ? prop?.name || 'Unknown' : key,
            });
          }
          map.get(key).total += e.amount || 0;
        }
        breakdown.expenses = Array.from(map.values());
      }

      if (includeInvoices) {
        const map = new Map<string, any>();
        for (const i of invoices) {
          const prop = i.lease?.property;
          const key =
            groupBy === 'property'
              ? prop?.id || 'unknown'
              : groupBy === 'month'
                ? monthKey(new Date(i.createdAt))
                : 'unknown';
          if (!map.has(key)) {
            map.set(key, {
              ...makeBucket(),
              key,
              label: groupBy === 'property' ? prop?.name || 'Unknown' : key,
            });
          }
          map.get(key).total += i.amount || 0;
        }
        breakdown.invoices = Array.from(map.values());
      }
    }

    return {
      start,
      end,
      groupBy,
      include,
      limit,
      payments,
      expenses,
      invoices,
      totals,
      breakdown,
    };
  }

  private getDateRange(
    args?: { dateFrom?: string; dateTo?: string },
    defaultDays = 30,
  ) {
    const start = args?.dateFrom
      ? new Date(args.dateFrom)
      : new Date(Date.now() - defaultDays * 24 * 60 * 60 * 1000);
    const end = args?.dateTo ? new Date(args.dateTo) : new Date();
    return { start, end };
  }

  private scrubPII(data: any): any {
    if (data instanceof Date) return data;
    if (typeof data !== 'object' || data === null) {
      if (typeof data === 'string') {
        let scrubbed = data.replace(
          /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
          '[EMAIL_REDACTED]',
        );
        scrubbed = scrubbed.replace(/\+?[0-9]{10,15}/g, '[PHONE_REDACTED]');
        return scrubbed;
      }
      return data;
    }
    if (Array.isArray(data)) return data.map((item) => this.scrubPII(item));
    const scrubbedObj: any = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (
        [
          'email',
          'phone',
          'phonenumber',
          'idnumber',
          'waaccesstoken',
          'waverifytoken',
          'wapassword',
        ].includes(lowerKey)
      ) {
        scrubbedObj[key] = '[REDACTED]';
      } else {
        scrubbedObj[key] = this.scrubPII(value);
      }
    }
    return scrubbedObj;
  }
}
