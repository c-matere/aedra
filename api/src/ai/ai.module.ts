import { Module, forwardRef } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { EmbeddingsService } from './embeddings.service';
import { ResponsePipelineService } from './response-pipeline.service';
import { CriticService } from './critic.service';
import { AiClassifierService } from './ai-classifier.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportsModule } from '../reports/reports.module';
import { MessagingModule } from '../messaging/messaging.module';
import { AuthService } from '../auth/auth.service';
import { UnitsModule } from '../units/units.module';

import { AuditModule } from '../audit/audit.module';
import { ValidationService } from './validation.service';
import { SystemDegradationService } from './system-degradation.service';
import { BullModule } from '@nestjs/bullmq';
import { AiQueueProcessor, AI_BACKGROUND_QUEUE } from './ai.queue.processor';
import { AiQuotaService } from './ai-quota.service';
import { EmergencyEscalationService } from './emergency-escalation.service';
import { CacheKeyBuilder } from './cache-key-builder';
import { FinancialCrossChecker } from './financial-cross-checker';
import { AiStagingService } from './ai-staging.service';
import { TemporalContextService } from './temporal-context.service';
import { ReceiptService } from './receipt.service';
import { ErrorRecoveryService } from './error-recovery.service';
import { NextStepOrchestrator } from './next-step-orchestrator.service';
import { AiReadToolService } from './ai-read-tool.service';
import { AiWriteToolService } from './ai-write-tool.service';
import { AiReportToolService } from './ai-report-tool.service';
import { AiToolRegistryService } from './ai-tool-registry.service';
import { AiWhatsappOrchestratorService } from './ai-whatsapp-orchestrator.service';
import { MenuRouterService } from './menu-router.service';
import { WordNetIntentResolver } from './wordnet-intent-resolver.util';
import { QueryEnrichmentService } from './query-enrichment.service';
import { WhatsAppFormatterService } from './whatsapp-formatter.service';
import { MainMenuService } from './main-menu.service';
import { WorkflowModule } from '../workflows/workflow.module';
import { WorkflowBridgeService } from './workflow-bridge.service';
import { QuorumBridgeService } from './quorum-bridge.service';


@Module({
    imports: [
        PrismaModule, 
        forwardRef(() => ReportsModule), 
        UnitsModule, 
        AuditModule, 
        forwardRef(() => MessagingModule),
        BullModule.registerQueue({
            name: AI_BACKGROUND_QUEUE,
        }),
        WorkflowModule,
    ],
    controllers: [AiController],
    providers: [
        AiService, 
        AuthService, 
        EmbeddingsService, 
        ResponsePipelineService, 
        CriticService, 
        AiClassifierService, 
        ValidationService, 
        SystemDegradationService, 
        AiQueueProcessor, 
        AiQuotaService,
        EmergencyEscalationService,
        CacheKeyBuilder,
        FinancialCrossChecker,
        AiStagingService,
        TemporalContextService,
        ReceiptService,
        ErrorRecoveryService,
        NextStepOrchestrator,
        AiReadToolService,
        AiWriteToolService,
        AiReportToolService,
        AiToolRegistryService,
        AiWhatsappOrchestratorService,
        MenuRouterService,
        WordNetIntentResolver,
        QueryEnrichmentService,
        WorkflowBridgeService,
        QuorumBridgeService,
        WhatsAppFormatterService,
        MainMenuService,
    ],

    exports: [
        AiService, 
        ResponsePipelineService, 
        CriticService, 
        ValidationService, 
        SystemDegradationService, 
        BullModule, 
        AiQuotaService,
        EmergencyEscalationService,
        CacheKeyBuilder,
        FinancialCrossChecker,
        AiStagingService,
        TemporalContextService,
        ReceiptService,
        ErrorRecoveryService,
        NextStepOrchestrator,
        AiReadToolService,
        AiWriteToolService,
        AiReportToolService,
        AiToolRegistryService,
        AiWhatsappOrchestratorService,
        MenuRouterService,
        QueryEnrichmentService,
        WorkflowBridgeService,
        QuorumBridgeService,
        WhatsAppFormatterService,
        MainMenuService,
    ],
})
export class AiModule { }
