import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from '../../../api/src/ai/ai.service';
import { PrismaService } from '../../../api/src/prisma/prisma.service';
import { ReportsGeneratorService } from '../../../api/src/reports/reports-generator.service';
import { ReportIntelligenceService } from '../../../api/src/reports/report-intelligence.service';
import { ReportsService } from '../../../api/src/reports/reports.service';
import { WhatsappService } from '../../../api/src/messaging/whatsapp.service';
import { AuthService } from '../../../api/src/auth/auth.service';
import { EmbeddingsService } from '../../../api/src/ai/embeddings.service';
import { AiClassifierService } from '../../../api/src/ai/ai-classifier.service';
import { ResponsePipelineService } from '../../../api/src/ai/response-pipeline.service';
import { CriticService } from '../../../api/src/ai/critic.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { UnitsService } from '../../../api/src/units/units.service';
import { RemindersService } from '../../../api/src/messaging/reminders.service';
import { AuditLogService } from '../../../api/src/audit/audit-log.service';
import { ValidationService } from '../../../api/src/ai/validation.service';
import { SystemDegradationService } from '../../../api/src/ai/system-degradation.service';
import { AiQuotaService } from '../../../api/src/ai/ai-quota.service';
import { AiStagingService } from '../../../api/src/ai/ai-staging.service';
import { EmergencyEscalationService } from '../../../api/src/ai/emergency-escalation.service';
import { CacheKeyBuilder } from '../../../api/src/ai/cache-key-builder';
import { FinancialCrossChecker } from '../../../api/src/ai/financial-cross-checker';
// Local shim to avoid pulling BullMQ into the test bundle
const getQueueToken = (_name: string) => 'AI_BACKGROUND_QUEUE';
import { AI_BACKGROUND_QUEUE } from '../../../api/src/ai/ai.queue.processor';
import { UserRole } from '../../../api/src/auth/roles.enum';

// Minimal harness to reach executeReportTool safely
describe('Report date range robustness', () => {
  let service: any;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: PrismaService, useValue: { payment: {}, expense: {}, invoice: {}, company: {}, tenant: {}, chatHistory: {}, chatMessage: {} } },
        { provide: ReportsGeneratorService, useValue: { generateCsv: jest.fn().mockResolvedValue('url'), generatePremiumPdf: jest.fn() } },
        { provide: ReportIntelligenceService, useValue: { generatePremiumInsights: jest.fn().mockResolvedValue({ analysis: '', narrative: '' }) } },
        { provide: ReportsService, useValue: {} },
        { provide: WhatsappService, useValue: {} },
        { provide: AuthService, useValue: {} },
        { provide: EmbeddingsService, useValue: { generateEmbedding: jest.fn() } },
        { provide: AiClassifierService, useValue: {} },
        { provide: ResponsePipelineService, useValue: {} },
        { provide: CriticService, useValue: {} },
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn() } },
        { provide: UnitsService, useValue: {} },
        { provide: RemindersService, useValue: {} },
        { provide: AuditLogService, useValue: {} },
        { provide: ValidationService, useValue: {} },
        { provide: SystemDegradationService, useValue: { reportDegradation: jest.fn(), getWarningBanner: jest.fn(), reset: jest.fn() } },
        { provide: AiQuotaService, useValue: { isQuotaExceeded: jest.fn().mockResolvedValue(false) } },
        { provide: AiStagingService, useValue: { purge: jest.fn() } },
        { provide: EmergencyEscalationService, useValue: {} },
        { provide: CacheKeyBuilder, useValue: { build: jest.fn() } },
        { provide: FinancialCrossChecker, useValue: { crossCheck: jest.fn() } },
        { provide: getQueueToken(AI_BACKGROUND_QUEUE), useValue: { add: jest.fn() } },
        { provide: 'BullQueue_ai-background-operations', useValue: { add: jest.fn() } },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    // stub dependent methods to avoid real calls
    service.getFinancialReportData = jest.fn().mockResolvedValue({
      start: '2026-03-01',
      end: '2026-03-31',
      groupBy: 'none',
      include: 'all',
      totals: {},
      breakdown: {},
      limit: 10,
      payments: [],
      expenses: [],
      invoices: [],
    });
    service.reportIntelligence = { generatePremiumInsights: jest.fn().mockResolvedValue(null) };
    service.reportsGenerator = { generateCsv: jest.fn().mockResolvedValue('url'), generatePremiumPdf: jest.fn() };
    service.backgroundQueue = { add: jest.fn() };
  });

  it('handles string start/end by coercing to Date when enqueueing report', async () => {
    const result = await service['executeReportTool']('generate_report_file', { format: 'pdf', reportType: 'Platform' }, { companyId: 'c1', role: UserRole.SUPER_ADMIN, phone: '+2547' }, UserRole.SUPER_ADMIN, 'en');
    expect(result.message).toMatch(/Report generation started/);
  });
});
