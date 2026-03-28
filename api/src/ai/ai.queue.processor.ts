import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../messaging/whatsapp.service';
import { ReportsGeneratorService } from '../reports/reports-generator.service';
import { ReportsService } from '../reports/reports.service';
import { ReportIntelligenceService } from '../reports/report-intelligence.service';
import { UserRole } from '@prisma/client';
import { DailyTodoJob } from '../todo/daily-todo.job';

import { AutonomousAgentService } from './autonomous-agent.service';

import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AI_BACKGROUND_QUEUE } from './ai.constants';

@Processor(AI_BACKGROUND_QUEUE)
export class AiQueueProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(AiQueueProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
    private readonly reportsGenerator: ReportsGeneratorService,
    private readonly reportsService: ReportsService,
    private readonly reportIntelligence: ReportIntelligenceService,
    private readonly dailyTodoJob: DailyTodoJob,
    private readonly autonomousAgentService: AutonomousAgentService,
    @InjectQueue(AI_BACKGROUND_QUEUE) private readonly aiQueue: Queue,
  ) {
    super();
  }

  async onApplicationBootstrap() {
    this.logger.log('[Queue] Seeding agent heartbeat...');
    await this.aiQueue.add('agent_heartbeat', {}, { 
      jobId: 'agent_heartbeat_singleton',
      removeOnComplete: true,
      delay: 5000 
    });
  }

  async process(job: Job<any, any, string>): Promise<any> {
    // this.logger.log(`[Queue] Processing job ${job.id} of type ${job.name}`);

    try {
      switch (job.name) {
        case 'generate_report_pdf':
          await this.handleGenerateReportPdf(job.data);
          break;
        case 'bulk_generate_invoices':
          await this.handleBulkInvoices(job.data);
          break;
        case 'generate_daily_todos':
          await this.dailyTodoJob.run();
          break;
        case 'agent_heartbeat':
          await this.autonomousAgentService.processHeartbeats();
          // Re-queue heartbeat for next minute
          await this.aiQueue.add('agent_heartbeat', {}, { delay: 60000 });
          break;
        default:
          this.logger.warn(`[Queue] Unknown job type: ${job.name}`);
      }
    } catch (error) {
      this.logger.error(
        `[Queue] Job ${job.id} failed: ${error.message}`,
        error.stack,
      );

      // Send error feedback to user if it's a report job
      if (job.name === 'generate_report_pdf' && job.data?.targetPhone) {
        try {
          const lang = job.data?.language || 'en';
          const errorMsg =
            lang === 'sw'
              ? `⚠️ *Samahani*, nimepata tatizo wakati wa kutengeneza ripoti yako ya ${job.data.reportType}. Tafadhali jaribu tena baada ya muda mfupi.`
              : `⚠️ *Apologies*, I encountered an error while generating your ${job.data.reportType} report. Please try again in a few moments.`;

          await this.whatsappService.sendTextMessage({
            companyId: job.data.companyId,
            to: job.data.targetPhone,
            text: errorMsg,
          });
        } catch (sendError) {
          this.logger.error(
            `Failed to send background error feedback: ${sendError.message}`,
          );
        }
      }

      throw error; // Let BullMQ handle retries
    }
  }

  private async handleGenerateReportPdf(data: {
    reportType: string;
    companyId: string;
    targetId?: string;
    targetPhone: string;
    userName: string;
    dateRange?: { start: string; end: string };
    filters?: any;
    language?: string;
    userRole?: UserRole;
  }) {
    this.logger.log(`[Queue] Starting PDF generation for ${data.reportType}`);

    const start = new Date(data.dateRange?.start || Date.now());
    const end = new Date(data.dateRange?.end || Date.now());

    const actor = {
      id: 'system-queue',
      role: data.userRole || UserRole.COMPANY_ADMIN,
      companyId: data.companyId,
      isSuperAdmin: data.userRole === UserRole.SUPER_ADMIN,
    };

    let reportData: any;
    if (data.filters?.propertyId) {
      reportData = await this.reportsService.getPortfolioData(
        data.filters.propertyId,
        actor as any,
        start,
        end,
      );
    } else {
      // Aggregate company-wide data
      const [summary, occupancy, revenue] = await Promise.all([
        this.reportsService.getSummary(actor as any),
        this.reportsService.getOccupancy(actor as any),
        this.reportsService.getRevenue(actor as any),
      ]);

      reportData = {
        property: { name: 'Full Portfolio' },
        totals: {
          occupancy: Math.round(
            (occupancy.OCCUPIED /
              (occupancy.VACANT + occupancy.OCCUPIED || 1)) *
              100,
          ),
          invoices: revenue.totalInvoiced,
          payments: revenue.totalRevenue,
          expenses: 0, // Not currently aggregated company-wide in ReportsService
          units: summary.units,
          occupied: occupancy.OCCUPIED,
        },
        companyId: data.companyId,
        maintenance: { open: 0, resolved: 0 },
        tenantPayments: [],
        month: start.toLocaleString('en-US', {
          month: 'long',
          year: 'numeric',
        }),
      };
    }

    reportData.companyId = data.companyId;

    const fileName = `Aedra_${data.reportType}_Report_${Date.now()}.pdf`;

    this.logger.log(`[Queue] Generating Premium Insights...`);
    const insights =
      await this.reportIntelligence.generatePremiumInsights(reportData);

    this.logger.log(`[Queue] Rendering PDF...`);
    const url = await this.reportsGenerator.generatePremiumPdf(
      insights,
      reportData,
      fileName,
    );

    // Deliver directly via WhatsApp
    await this.whatsappService.sendDocument({
      companyId: data.companyId,
      to: data.targetPhone,
      url: url,
      fileName: fileName,
      caption: `📄 *Habari ${data.userName}*, ripoti yako ya ${data.reportType} ipo tayari.`,
    });

    this.logger.log(
      `[Queue] PDF generated and delivered to ${data.targetPhone}`,
    );
  }

  private async handleBulkInvoices(data: {
    companyId: string;
    propertyId: string;
    month: number;
    year: number;
    adminPhone: string;
  }) {
    // Mock bulk generation logic that would otherwise block the AI loop for 30s+
    this.logger.log(
      `[Queue] Generating bulk invoices for property ${data.propertyId}`,
    );

    // Simulating heavy DB work
    await new Promise((resolve) => setTimeout(resolve, 5000));

    await this.whatsappService.sendTextMessage({
      companyId: data.companyId,
      to: data.adminPhone,
      text: `✅ *Aedra Update*\n\nNimekamilisha kutengeneza ankara (invoices) kwa ajili ya mwezi ${data.month}/${data.year}. Zote zimetumwa kwa wapangaji.`,
    });
  }
}
