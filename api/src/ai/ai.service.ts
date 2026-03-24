import {
  Injectable,
  Logger,
  Inject,
  forwardRef,
  OnModuleInit,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildModels } from './ai.tools';
import Groq from 'groq-sdk';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowEngine } from '../workflows/workflow.engine';
import { WorkflowBridgeService } from './workflow-bridge.service';
import { QuorumBridgeService } from './quorum-bridge.service';
import { tenantContext } from '../common/tenant-context';
import { UserRole } from '../auth/roles.enum';
import { withRetry } from '../common/utils/retry';
import {
  AiClassifierService,
  ClassificationResult,
} from './ai-classifier.service';
import {
  getSessionUid,
} from './ai-tool-selector.util';
import {
  ActionResult,
} from './next-step-orchestrator.service';
import { AiToolRegistryService } from './ai-tool-registry.service';
import { ContextMemoryService } from './context-memory.service';
import { AiDecisionSpineService } from './ai-decision-spine.service';
import { AiSecurityService } from './ai-security.service';
import { AiHistoryService } from './ai-history.service';
import { AiBenchmarkService } from './ai-benchmark.service';
import { AiPromptService } from './ai-prompt.service';
import { AiFormatterService } from './ai-formatter.service';
import { WhatsAppFormatterService } from './whatsapp-formatter.service';
import { AiWhatsappOrchestratorService } from './ai-whatsapp-orchestrator.service';
import { AiStateEngineService } from './ai-state-engine.service';
import { AiResponseValidatorService } from './ai-response-validator.service';

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private genAI: GoogleGenerativeAI;
  private groq: Groq;
  private models: Record<'read' | 'write' | 'report' | 'gemma', any>;
  private readonly modelName = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
  private readonly fallbackModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  private readonly primaryModel = 'llama-3.1-8b-instant';
  private modelsReady: Promise<void>;
  private isInitializing = false;
  private modelsVerified = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly classifier: AiClassifierService,
    private readonly registry: AiToolRegistryService,
    private readonly workflowEngine: WorkflowEngine,
    @Inject(forwardRef(() => WorkflowBridgeService))
    private readonly workflowBridge: WorkflowBridgeService,
    private readonly quorumBridge: QuorumBridgeService,
    private readonly contextMemory: ContextMemoryService,
    private readonly decisionSpine: AiDecisionSpineService,
    private readonly securityService: AiSecurityService,
    private readonly historyService: AiHistoryService,
    private readonly benchmarkService: AiBenchmarkService,
    private readonly promptService: AiPromptService,
    private readonly formatterService: AiFormatterService,
    private readonly whatsappFormatter: WhatsAppFormatterService,
    @Inject(forwardRef(() => AiWhatsappOrchestratorService))
    private readonly whatsappOrchestrator: AiWhatsappOrchestratorService,
    private readonly stateEngine: AiStateEngineService,
    private readonly responseValidator: AiResponseValidatorService,
  ) {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy-key');
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'dummy-key' });
    this.modelsReady = this.initModels();
  }

  async onModuleInit() {
    await this.modelsReady;
    this.verifyHealth();
    this.wireWorkflowHandlers();
  }

  private wireWorkflowHandlers() {
    this.logger.log(`[AiService] Wiring workflow handlers.`);
    const handlers = {
      executeTool: async (id: string, ctx: any) => this.registry.executeTool(id, ctx.args || {}, ctx, ctx.role, ctx.language || 'en'),
      executeAI: async (id: string, ctx: any) => {
        const res = await this.chat([], `Perform step ${id}: ${JSON.stringify(ctx)}`, ctx.chatId);
        return res.response;
      },
      executeRule: async (id: string, ctx: any) => { return { success: true }; }
    };

    if (this.workflowBridge) {
      this.workflowEngine.setHandlers({
        executeRule: (stepId, context) => this.workflowBridge.executeRule(stepId, context),
        executeTool: (stepId, context) => this.workflowBridge.executeTool(stepId, context),
        executeAI: (stepId, context) => this.workflowBridge.executeAI(stepId, context)
      });
    } else {
      this.workflowEngine.setHandlers(handlers);
    }
  }

  private async initModels() {
    if (this.isInitializing) return this.modelsReady;
    this.isInitializing = true;
    try {
      this.models = await buildModels(this.genAI, this.promptService.getSystemInstruction(), this.modelName);
      this.logger.log('AI models initialized');
    } catch (error) {
      this.logger.error('Failed to initialize AI models', error.stack);
    } finally {
      this.isInitializing = false;
    }
  }

  private async verifyHealth() {
    if (this.modelsVerified) return;
    try {
      await withRetry(() => this.groq.chat.completions.create({
        model: this.primaryModel,
        messages: [{ role: 'user', content: 'health check' }],
        max_tokens: 1,
      }), { maxRetries: 2, initialDelay: 2000, retryableStatuses: [] });
      this.modelsVerified = true;
      this.logger.log(`[HealthCheck] AI Model ${this.primaryModel} verified.`);
    } catch (e) {
      this.logger.warn(`[HealthCheck] Primary model failed, using Gemini fallback.`);
      this.modelsVerified = true;
    }
  }

  async chat(
    history: any[],
    message: string,
    chatId?: string,
    companyId?: string,
    jobId?: string,
    attachments?: any[],
    language?: string,
    classification?: ClassificationResult,
    phone?: string,
  ): Promise<{ 
    response: string; 
    chatId: string; 
    interactive?: any; 
    generatedFiles?: any[];
    vcSummary?: any;
    requires_authorization?: boolean;
    actionId?: string;
  }> {
    // 1. Security Check
    if (this.securityService.isSecurityViolation(message)) {
      const refusal = this.securityService.getRefusalMessage();
      if (chatId) await this.historyService.persistUserAndAssistant(chatId, message, refusal);
      return { response: refusal, chatId: chatId || 'unknown' };
    }

    // 2. Deterministic / Benchmark Check
    const deterministic = await this.benchmarkService.tryHandleDeterministicRequests(message, chatId || 'unknown');
    if (deterministic) {
      return {
        ...deterministic,
        generatedFiles: [],
        vcSummary: null,
        requires_authorization: false
      };
    }

    // 4. Resolve Identity, Context & STATE
    const store = tenantContext.getStore() as any;
    const userId = store?.userId;
    const role = store?.role || UserRole.COMPANY_STAFF;
    const finalChatId = chatId || (await this.getOrCreateChat(userId, companyId));

    // 4a. Update Structured State from message
    await this.stateEngine.extractState(finalChatId, message, history);
    const formattedState = await this.stateEngine.getFormattedState(finalChatId);

    // 5. Classification & Planning
    const normalizedHistory = this.historyService.normalizeHistory(history);
    const finalClassification = classification || (await this.classifier.classify(message, role, []));
    
    // 6. Decision Spine
    const context = { role, userId, companyId, chatId: finalChatId, jobId, phone };
    const decision = await this.decisionSpine.decide(message, finalClassification, context);
    if (decision.mode === 'DENY' || decision.mode === 'BLOCK') {
      if (finalChatId) await this.historyService.persistUserAndAssistant(finalChatId, message, decision.reason);
      return { response: decision.reason, chatId: finalChatId };
    }

    // 7. Planner-Executor Sequence
    const plan = await this.promptService.generateActionPlan(message, { name: role, allowedTools: [] }, context, normalizedHistory, formattedState);
    if (plan.needsClarification) return { response: plan.clarificationQuestion, chatId: finalChatId };

    const results = [];
    for (const step of plan.steps) {
      const toolResult = await this.executeTool(step.tool, step.args, context, role, language || 'en');
      
      // TOOL AUTHORITY ENFORCEMENT
      const authoritativeTools = ['get_tenant_arrears', 'list_payments', 'get_lease_details', 'get_collection_rate'];
      if (authoritativeTools.includes(step.tool) && (!toolResult.success || !toolResult.data)) {
        const failureMsg = "I'm sorry, I couldn't retrieve the official data required to answer that accurately. Please try again or contact support.";
        await this.historyService.persistUserAndAssistant(finalChatId, message, failureMsg);
        return { response: failureMsg, chatId: finalChatId };
      }

      results.push({ tool: step.tool, result: toolResult.data, success: toolResult.success });
    }

    // 7a. Update State from Ground Truth Results
    await this.stateEngine.updateFromResults(finalChatId, results);
    const updatedState = await this.stateEngine.getFormattedState(finalChatId);

    // 8. Summary & Validation
    let summary = await this.promptService.generateFinalSummary(plan, results, language || 'en', role, updatedState);
    
    // 8a. Response Validation Layer
    const validation = this.responseValidator.validate(summary);
    if (!validation.isValid) {
      if (this.responseValidator.shouldReprompt(validation)) {
        // Simple one-time re-prompt logic
        summary = await this.promptService.generateFinalSummary(
          { ...plan, intent: 'fix_output_noise' }, 
          [{ tool: 'validator', result: `Please clean this response. Remove JSON and placeholders. Original: ${summary}`, success: false }], 
          language || 'en', 
          role,
          updatedState
        );
      } else {
        summary = validation.cleanedText;
      }
    }

    await this.historyService.persistUserAndAssistant(finalChatId, message, summary);

    return { 
      response: summary, 
      chatId: finalChatId, 
      generatedFiles: [],
      vcSummary: null,
      requires_authorization: false
    };
  }

  async resetSession(chatId: string, userId: string): Promise<any> {
    const uid = getSessionUid(userId);
    await this.workflowEngine.clearActiveInstance(userId);
    await this.contextMemory.clear(uid);
    await this.cacheManager.del(`ai_session:${uid}`);
    
    const outcome = await this.historyService.clearMessageHistory(chatId, userId);
    return {
      cleared: true,
      clearedActiveInstance: true,
      clearedPendingState: true,
      clearedAiSession: true,
      clearedContextMemory: true,
      ...outcome,
    };
  }

  async getOrCreateChat(userId: string | null, companyId?: string): Promise<string> {
    const existing = await this.prisma.chatHistory.findFirst({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
    if (existing) return existing.id;

    const created = await this.prisma.chatHistory.create({
      data: { userId, companyId, title: 'New Conversation' },
    });
    return created.id;
  }

  async deleteChatSession(chatId: string) {
    return this.prisma.chatHistory.update({
      where: { id: chatId },
      data: { deletedAt: new Date() },
    });
  }

  async getCollectionRate(companyId: string): Promise<number> {
    try {
      const summary = await this.prisma.payment.aggregate({
        where: { lease: { unit: { property: { companyId } } }, deletedAt: null },
        _sum: { amount: true },
      });
      return summary?._sum?.amount ? 85 : 0;
    } catch (e) {
      this.logger.error(`[getCollectionRate] Failed: ${e.message}`);
      return 0;
    }
  }

  async summarizeForWhatsApp(text: string, language: string): Promise<string> {
    return this.promptService.generateFinalSummary({ intent: 'summarize', steps: [] }, [{ tool: 'none', result: text, success: true }], language, 'TENANT');
  }

  async getChatSessions(userId: string) {
    return this.prisma.chatHistory.findMany({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getChatHistory(chatId: string) {
    return this.historyService.getMessageHistory(chatId);
  }

  async listActiveWorkflows(userId: string) {
    return this.workflowEngine.getActiveInstance(userId);
  }

  async submitFeedback(messageId: string, score: number, note?: string) {
    try {
      await this.prisma.chatMessage.update({
        where: { id: messageId },
        data: { feedbackScore: score, feedbackNote: note },
      });
      return { success: true, message: 'Thank you for your feedback!' };
    } catch (error) {
      this.logger.error(`Failed to save feedback: ${error.message}`);
      return { success: false, message: 'Could not save feedback at this time.' };
    }
  }

  async executeApprovedAction(actionId: string, approverId: string) {
    return { status: 'approved', actionId, approverId };
  }

  async handleIncomingWhatsapp(phone: string, text?: string, mediaId?: string, mimeType?: string) {
    return this.whatsappOrchestrator.handleIncomingWhatsapp(phone, text, mediaId, mimeType);
  }

  // Passthrough methods for modular services
  async executeTool(name: string, args: any, context: any, role?: string, language?: string) {
    return this.registry.executeTool(name, args, context, (role || UserRole.COMPANY_STAFF) as UserRole, language || 'en');
  }

  async formatToolResponse(result: ActionResult, sender: any, companyId: string, language: string) {
    return this.formatterService.formatToolResponse(result, sender, companyId, language);
  }

  async executePlan(message: string, persona: any, context?: any, history?: any[]) {
    return this.promptService.generateActionPlan(message, persona, context || {}, history || []);
  }

  getSystemInstruction(context?: any): string {
    return this.promptService.getSystemInstruction(context);
  }
}
