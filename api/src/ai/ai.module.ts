import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AiController } from './ai.controller';
import { AiBrainClient } from './ai-brain.client';
import { BrainToolController } from './brain-tool.controller';
import { AiService } from './ai.service'; // Keep the type/class for provide/useClass

import { PrismaModule } from '../prisma/prisma.module';
import { ReportsModule } from '../reports/reports.module';
import { MessagingModule } from '../messaging/messaging.module';
import { AuthModule } from '../auth/auth.module';
import { UnitsModule } from '../units/units.module';
import { CacheModule } from '@nestjs/cache-manager';

import { AuditModule } from '../audit/audit.module';
import { ValidationService } from './validation.service';
import { SystemDegradationService } from './system-degradation.service';
import { AiEntityResolutionService } from './ai-entity-resolution.service';
import { ConsistencyValidatorService } from './consistency-validator.service';
import { BullModule } from '@nestjs/bullmq';
import { AI_BACKGROUND_QUEUE } from './ai.constants';
import { AiQueueProcessor } from './ai.queue.processor';

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
import { ContextMemoryService } from './context-memory.service';
import { AiSecurityService } from './ai-security.service';
import { AiHistoryService } from './ai-history.service';
import { AiStateEngineService } from './ai-state-engine.service';
import { AiNextStepController } from './ai-next-step-controller.service';

import { WorkflowStateMachineService } from './workflow-state-machine.service';

import { FinancesModule } from '../finances/finances.module';
@Module({
  imports: [
    PrismaModule,
    forwardRef(() => ReportsModule),
    UnitsModule,
    AuditModule,
    forwardRef(() => MessagingModule),
    HttpModule,
    BullModule.registerQueue({
      name: AI_BACKGROUND_QUEUE,
    }),
    WorkflowModule,
    forwardRef(() => TodoModule),
    CacheModule.register(),
    forwardRef(() => FinancesModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [AiController, BrainToolController],
  providers: [
    AiService,
    AiBrainClient,
    ValidationService,
    SystemDegradationService,
    AiQueueProcessor,
    AiEntityResolutionService,
    ConsistencyValidatorService,
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
    WorkflowBridgeService,
    QuorumBridgeService,
    WhatsAppFormatterService,
    MainMenuService,
    AiPythonExecutorService,
    WaCrudButtonsService,
    FeedbackService,
    AutonomousAgentService,
    ContextMemoryService,
    AiSecurityService,
    AiHistoryService,
    AiStateEngineService,
    AiNextStepController,
    WorkflowStateMachineService,
  ],
  exports: [
    AiService,
    AiBrainClient,
    SystemDegradationService,
    BullModule,
    AiReadToolService,
    AiWriteToolService,
    AiReportToolService,
    AiHistoryToolService,
    AiToolRegistryService,
    AiWhatsappOrchestratorService,
    WorkflowBridgeService,
    QuorumBridgeService,
    WhatsAppFormatterService,
    MainMenuService,
    AiPythonExecutorService,
    WaCrudButtonsService,
    FeedbackService,
    AutonomousAgentService,
    AiSecurityService,
    AiHistoryService,
    AiStateEngineService,
    WorkflowStateMachineService,
    ErrorRecoveryService,
  ],
})
export class AiModule {}
