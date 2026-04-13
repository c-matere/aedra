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
import { PaymentsModule } from '../payments/payments.module';
import { AuthModule } from '../auth/auth.module';
import { UnitsModule } from '../units/units.module';
import { CacheModule } from '@nestjs/cache-manager';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

import { AuditModule } from '../audit/audit.module';
import { ValidationService } from './validation.service';
import { SystemDegradationService } from './system-degradation.service';
import { BullModule } from '@nestjs/bullmq';
import { AI_BACKGROUND_QUEUE } from './ai.constants';
import { AiQueueProcessor } from './ai.queue.processor';
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
import { AiHistoryToolService } from './ai-history-tool.service';
import { AiToolRegistryService } from './ai-tool-registry.service';
import { AiWhatsappOrchestratorService } from './ai-whatsapp-orchestrator.service';
import { MenuRouterService } from './menu-router.service';
import { QueryEnrichmentService } from './query-enrichment.service';
import { WhatsAppFormatterService } from './whatsapp-formatter.service';
import { MainMenuService } from './main-menu.service';
import { WorkflowModule } from '../workflows/workflow.module';
import { WorkflowBridgeService } from './workflow-bridge.service';
import { QuorumBridgeService } from './quorum-bridge.service';
import { TodoModule } from '../todo/todo.module';
import { AiPythonExecutorService } from './ai-python-executor.service';
import { WaCrudButtonsService } from './wa-crud-buttons.service';
import { FeedbackService } from './feedback.service';
import { AutonomousAgentService } from './autonomous-agent.service';
import { AiEntityResolutionService } from './ai-entity-resolution.service';
import { ContextMemoryService } from './context-memory.service';
import { AiDecisionSpineService } from './ai-decision-spine.service';
import { AiSecurityService } from './ai-security.service';
import { AiHistoryService } from './ai-history.service';
import { AiBenchmarkService } from './ai-benchmark.service';
import { AiPromptService } from './ai-prompt.service';
import { AiFormatterService } from './ai-formatter.service';
import { AiStateEngineService } from './ai-state-engine.service';
import { AiResponseValidatorService } from './ai-response-validator.service';
import { AiFactCheckerService } from './ai-fact-checker.service';
import { AiValidatorService } from './ai-validator.service';
import { AiIntentFirewallService } from './ai-intent-firewall.service';
import { ConsistencyValidatorService } from './consistency-validator.service';
import { AiNextStepController } from './ai-next-step-controller.service';
import { AiIntentNormalizerService } from './ai-intent-normalizer.service';
import { InterpretationLayer } from './layers/interpretation-layer.service';
import { DecisionLayer } from './layers/decision-layer.service';
import { PolicyLayer } from './layers/policy-layer.service';
import { WorkflowLayer } from './layers/workflow-layer.service';
import { IntegrityValidationLayer } from './layers/integrity-validation-layer.service';
import { RoleRouter } from './role-router.service';
import { TenantIntentStrategy } from './strategies/tenant-intent.strategy';
import { StaffIntentStrategy } from './strategies/staff-intent.strategy';
import { LandlordIntentStrategy } from './strategies/landlord-intent.strategy';
import { WorkflowStateMachineService } from './workflow-state-machine.service';

import { FinancesModule } from '../finances/finances.module';
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
    forwardRef(() => TodoModule),
    CacheModule.register(),
    FinancesModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [AiController],
  providers: [
    AiService,
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
    AiHistoryToolService,
    AiToolRegistryService,
    AiWhatsappOrchestratorService,
    MenuRouterService,
    QueryEnrichmentService,
    WorkflowBridgeService,
    QuorumBridgeService,
    WhatsAppFormatterService,
    MainMenuService,
    AiPythonExecutorService,
    WaCrudButtonsService,
    FeedbackService,
    AutonomousAgentService,
    AiEntityResolutionService,
    ContextMemoryService,
    AiDecisionSpineService,
    AiSecurityService,
    AiHistoryService,
    AiBenchmarkService,
    AiPromptService,
    AiFormatterService,
    AiStateEngineService,
    AiResponseValidatorService,
    AiFactCheckerService,
    AiValidatorService,
    AiIntentFirewallService,
    ConsistencyValidatorService,
    AiNextStepController,
    AiIntentNormalizerService,
    InterpretationLayer,
    DecisionLayer,
    PolicyLayer,
    WorkflowLayer,
    IntegrityValidationLayer,
    RoleRouter,
    TenantIntentStrategy,
    StaffIntentStrategy,
    LandlordIntentStrategy,
    WorkflowStateMachineService,
    {
      provide: GoogleGenerativeAI,
      useFactory: () =>
        new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy-key'),
    },
    {
      provide: Groq,
      useFactory: () =>
        new Groq({ apiKey: process.env.GROQ_API_KEY || 'dummy-key' }),
    },
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
    AiHistoryToolService,
    AiToolRegistryService,
    AiWhatsappOrchestratorService,
    MenuRouterService,
    QueryEnrichmentService,
    WorkflowBridgeService,
    QuorumBridgeService,
    WhatsAppFormatterService,
    MainMenuService,
    AiPythonExecutorService,
    WaCrudButtonsService,
    FeedbackService,
    AutonomousAgentService,
    AiEntityResolutionService,
    ContextMemoryService,
    AiDecisionSpineService,
    AiSecurityService,
    AiHistoryService,
    AiBenchmarkService,
    AiPromptService,
    AiFormatterService,
    AiStateEngineService,
    AiResponseValidatorService,
    AiFactCheckerService,
    AiValidatorService,
    AiIntentFirewallService,
    ConsistencyValidatorService,
    AiNextStepController,
    AiIntentNormalizerService,
    InterpretationLayer,
    DecisionLayer,
    PolicyLayer,
    WorkflowLayer,
    IntegrityValidationLayer,
    RoleRouter,
    TenantIntentStrategy,
    StaffIntentStrategy,
    LandlordIntentStrategy,
    WorkflowStateMachineService,
    Groq,
  ],
})
export class AiModule {}
