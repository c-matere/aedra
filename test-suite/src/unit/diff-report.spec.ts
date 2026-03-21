import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from '../../../api/src/ai/ai.service';
import { PrismaService } from '../../../api/src/prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { WhatsappService } from '../../../api/src/messaging/whatsapp.service';
import { ResponsePipelineService } from '../../../api/src/ai/response-pipeline.service';
import { CriticService } from '../../../api/src/ai/critic.service';
import { AiClassifierService } from '../../../api/src/ai/ai-classifier.service';
import { UnitsService } from '../../../api/src/units/units.service';
import { AuditLogService } from '../../../api/src/audit/audit-log.service';
import { SystemDegradationService } from '../../../api/src/ai/system-degradation.service';
import { AiQuotaService } from '../../../api/src/ai/ai-quota.service';
import { ErrorRecoveryService } from '../../../api/src/ai/error-recovery.service';
import { NextStepOrchestrator } from '../../../api/src/ai/next-step-orchestrator.service';
import { AiToolRegistryService } from '../../../api/src/ai/ai-tool-registry.service';
import { AiWhatsappOrchestratorService } from '../../../api/src/ai/ai-whatsapp-orchestrator.service';
import { QueryEnrichmentService } from '../../../api/src/ai/query-enrichment.service';
import { WorkflowEngine } from '../../../api/src/workflows/workflow.engine';
import { WorkflowBridgeService } from '../../../api/src/ai/workflow-bridge.service';
import { QuorumBridgeService } from '../../../api/src/ai/quorum-bridge.service';
import { WhatsAppFormatterService } from '../../../api/src/ai/whatsapp-formatter.service';
import { EmbeddingsService } from '../../../api/src/ai/embeddings.service';
import { getQueueToken } from '@nestjs/bullmq';
import { AI_BACKGROUND_QUEUE } from '../../../api/src/ai/ai.queue.processor';

describe('AiService Reporting Rules', () => {
    let aiService: AiService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AiService,
                { provide: PrismaService, useValue: {} },
                { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn() } },
                { provide: WhatsappService, useValue: {} },
                { provide: ResponsePipelineService, useValue: {} },
                { provide: CriticService, useValue: {} },
                { provide: AiClassifierService, useValue: {} },
                { provide: UnitsService, useValue: {} },
                { provide: AuditLogService, useValue: {} },
                { provide: SystemDegradationService, useValue: { getWarningBanner: jest.fn() } },
                { provide: AiQuotaService, useValue: {} },
                { provide: ErrorRecoveryService, useValue: {} },
                { provide: NextStepOrchestrator, useValue: {} },
                { provide: AiToolRegistryService, useValue: {} },
                { provide: AiWhatsappOrchestratorService, useValue: {} },
                { provide: QueryEnrichmentService, useValue: { enrich: jest.fn(m => m) } },
                { provide: WorkflowEngine, useValue: { setHandlers: jest.fn() } },
                { provide: WorkflowBridgeService, useValue: {} },
                { provide: QuorumBridgeService, useValue: {} },
                { provide: WhatsAppFormatterService, useValue: {} },
                { provide: EmbeddingsService, useValue: {} },
                { provide: getQueueToken(AI_BACKGROUND_QUEUE), useValue: {} },
            ],
        }).compile();

        aiService = module.get<AiService>(AiService);
    });

    it('should include [REPORTING_RULES] in system message', async () => {
        const message = 'Add a penalty';
        const context = { role: 'COMPANY_STAFF' };
        
        // buildSystemMessage is private, we access it via any for testing context
        const systemPrompt = await (aiService as any).buildSystemMessage(message, context, 'en');
        
        expect(systemPrompt).toContain('[REPORTING_RULES]');
        expect(systemPrompt).toContain('MANDATORY CHANGE SUMMARY');
        expect(systemPrompt).toContain('📊 System Change Summary');
    });
});
