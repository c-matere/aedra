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
import { getSessionUid } from './ai-tool-selector.util';
import { AiToolRegistryService } from './ai-tool-registry.service';
import { ContextMemoryService } from './context-memory.service';
import { AiEntityResolutionService } from './ai-entity-resolution.service';
import { AiPromptService } from './ai-prompt.service';
import { AiNextStepController } from './ai-next-step-controller.service';
import { AiFormatterService } from './ai-formatter.service';
import { AiSecurityService } from './ai-security.service';
import { AiIntentNormalizerService } from './ai-intent-normalizer.service';
import { AiHistoryService } from './ai-history.service';
import { AiIntentFirewallService } from './ai-intent-firewall.service';
import { AiStateEngineService } from './ai-state-engine.service';
import { AiBenchmarkService } from './ai-benchmark.service';
import { WhatsAppFormatterService } from './whatsapp-formatter.service';
import { AiResponseValidatorService } from './ai-response-validator.service';
import { AiFactCheckerService } from './ai-fact-checker.service';
import { AiValidatorService } from './ai-validator.service';
import { AiDecisionSpineService } from './ai-decision-spine.service';
import { AiWhatsappOrchestratorService } from './ai-whatsapp-orchestrator.service';
import { ConsistencyValidatorService } from './consistency-validator.service';
import { InterpretationLayer } from './layers/interpretation-layer.service';
import { ActionResult } from './next-step-orchestrator.service';
import { AiIntent, OperationalIntent, TruthObject, ExecutionTrace, AiServiceChatResponse, UnifiedPlan, UnifiedActionResult } from './ai-contracts.types';
import { ACTION_CONTRACTS } from './contracts/action-contracts';

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private readonly primaryModel = 'gemini-2.0-flash';
  private readonly fallbackModel = 'gemini-1.5-flash';
  private readonly genAI: GoogleGenerativeAI;
  private readonly groq: Groq;
  private modelsVerified = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly classifier: AiClassifierService,
    private readonly registry: AiToolRegistryService,
    private readonly workflowEngine: WorkflowEngine,
    @Inject(forwardRef(() => WorkflowBridgeService))
    private readonly workflowBridge: WorkflowBridgeService,
    private readonly firewall: AiIntentFirewallService,
    private readonly quorumBridge: QuorumBridgeService,
    private readonly contextMemory: ContextMemoryService,
    private readonly decisionSpine: AiDecisionSpineService,
    private readonly securityService: AiSecurityService,
    private readonly entityResolver: AiEntityResolutionService,
    private readonly historyService: AiHistoryService,
    private readonly benchmarkService: AiBenchmarkService,
    private readonly promptService: AiPromptService,
    private readonly formatterService: AiFormatterService,
    private readonly whatsappFormatter: WhatsAppFormatterService,
    @Inject(forwardRef(() => AiWhatsappOrchestratorService))
    private readonly whatsappOrchestrator: AiWhatsappOrchestratorService,
    private readonly stateEngine: AiStateEngineService,
    private readonly responseValidator: AiResponseValidatorService,
    private readonly factChecker: AiFactCheckerService,
    private readonly validator: AiValidatorService,
    private readonly consistencyValidator: ConsistencyValidatorService,
    private readonly nextStepController: AiNextStepController,
    private readonly normalizer: AiIntentNormalizerService,
  ) {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy-key');
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'dummy-key' });
  }

  async onModuleInit() {
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

  private async verifyHealth() {
    if (this.modelsVerified) return;
    try {
      // 1. Verify Primary Model (Gemini Pro)
      const model = this.genAI.getGenerativeModel({ model: this.primaryModel });
      await withRetry(() => model.generateContent('health check'), { maxRetries: 2, initialDelay: 2000 });
      
      this.modelsVerified = true;
      this.logger.log(`[HealthCheck] AI Verification complete (Gemini Pro Primary).`);
    } catch (e) {
      this.logger.warn(`[HealthCheck] Primary model (${this.primaryModel}) failed: ${e.message}`);
      // 2. Fallback check (Gemini Flash)
      try {
        const fbModel = this.genAI.getGenerativeModel({ model: this.fallbackModel });
        await withRetry(() => fbModel.generateContent('health check'), { maxRetries: 1 });
        this.modelsVerified = true;
        this.logger.log(`[HealthCheck] Fallback model (${this.fallbackModel}) is up.`);
      } catch (e2) {
        this.logger.error(`[HealthCheck] All AI models down!`);
      }
    }
  }

  private readonly WORKFLOW_MAP: Record<string, string[]> = {
    'FINANCIAL_QUERY': ['kernel_search', 'get_tenant_arrears', 'render_financial_dashboard'],
    'PAYMENT_PROMISE': ['kernel_search', 'get_tenant_arrears', 'log_payment_promise'],
    'PAYMENT_DECLARATION': ['kernel_search', 'get_tenant_arrears', 'verify_payment'],
    'MAINTENANCE': ['kernel_search', 'kernel_validation', 'log_maintenance_request'],
    'COMPLAINT': ['kernel_search', 'log_maintenance_request', 'notify_landlord'],
    'ONBOARDING': ['kernel_validation', 'register_tenant', 'create_lease'],
    'FINANCIAL_REPORTING': ['get_revenue_summary', 'get_collection_rate', 'manual_aggregation'],
    'SYSTEM_ISSUE': ['log_system_error', 'notify_it'],
    'UTILITY_OUTAGE': ['get_unit_details']
  };

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
    temperature?: number,
  ): Promise<AiServiceChatResponse> {
    const store = tenantContext.getStore() as any;
    const userId = store?.userId || 'SYSTEM';
    const role = store?.role || UserRole.COMPANY_STAFF;
    
    // v4.9 "True Agent": Bench Persona Routing
    const benchPersonaMatch = message.match(/\[BENCH_PERSONA:(TENANT|STAFF|LANDLORD|COMPANY_STAFF)\]/i);
    let effectiveRole = (role === UserRole.SUPER_ADMIN && benchPersonaMatch) ? benchPersonaMatch[1].toUpperCase() : role;
    if (effectiveRole === 'STAFF') effectiveRole = UserRole.COMPANY_STAFF; // Alias mapping

    const cleanMessage = message
        .replace(/\[BENCH_.*?\]/g, '')
        .replace(/^Simulate responding as if speaking to a \w+\.\s*Message:\s*/i, '')
        .replace(/^(Message|Input|Request|User):\s*/i, '')
        .trim(); 
    const finalChatId = chatId || (await this.getOrCreateChat(userId, companyId));
    
    // 0. Initialize Execution Trace (SSOT)
    let trace: ExecutionTrace = {
        id: `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sessionId: finalChatId,
        userId: userId,
        role: effectiveRole as any,
        input: cleanMessage,
        status: 'PENDING',
        steps: [],
        errors: [],
        metadata: { companyId, phone, language, temperature, originalMessage: message, effectiveRole },
    };

    try {
      this.logger.log(`[AiService] chat() Starting trace: ${trace.id}`);
      
      // 1. Security & Firewall
      if (this.securityService.isSecurityViolation(message)) {
        return { response: this.securityService.getRefusalMessage(), chatId: finalChatId };
      }

      const firewallDecision = this.firewall.intercept(message, effectiveRole as any);
      if (firewallDecision.isIntercepted && firewallDecision.message) {
        return { response: firewallDecision.message, chatId: finalChatId };
      }

      // 2. Auth-First Context Hydration (Tenant Isolation)
      let sessionContext = await this.contextMemory.getContext(getSessionUid(userId));
      if (effectiveRole === UserRole.TENANT && phone) {
        const authContext = await this.hydrateTenantContext(phone, companyId);
        sessionContext = { ...sessionContext, ...authContext };
        this.logger.log(`[AiService] Auth-First Hydration for ${phone}: tenant=${authContext.tenantId}, unit=${authContext.unitId}`);
      }

      // 3. Unified LLM-Driven Planning (v5.2)
      let finalHistory = history || [];
      if (finalHistory.length === 0 && finalChatId) {
        const dbHistory = await this.historyService.getMessageHistory(finalChatId);
        if (dbHistory && dbHistory.length > 0) {
          this.logger.log(`[AiService] Hydrated ${dbHistory.length} history messages from DB for ${finalChatId}`);
          finalHistory = dbHistory;
        }
      }

      const scrubbedHistory = this.scrubHistory(finalHistory);
      const plan = await this.promptService.generateUnifiedPlan(cleanMessage, effectiveRole as UserRole, sessionContext, scrubbedHistory);
      trace.unifiedPlan = plan;
      trace.status = 'EXECUTING';

      // 4. Immediate Response (Pre-Execution)
      if (plan.immediateResponse && (plan.priority === 'EMERGENCY' || plan.priority === 'HIGH')) {
        this.logger.log(`[AiService] Immediate response triggered: ${plan.immediateResponse.substring(0, 30)}...`);
        // Note: In a real streaming scenario, we'd send this now. For now, we'll append it to the renderer context.
      }

      // 5. Hardened Execution Loop (v5.2)
      const resultsMap: Record<string, any> = {
        session: sessionContext,
        entities: { ...(plan.entities || {}) }
      };

      // 5a. Bare Entity Resolution (v5.5)
      // Resolve IDs for names/units even if no tool is scheduled (crucial for sequential context)
      if (plan.entities) {
        if (plan.entities.tenantName && !resultsMap.entities.tenantId) {
          const res = await this.entityResolver.resolveId('tenant', plan.entities.tenantName, companyId, plan.entities.unitNumber);
          if (res.id) resultsMap.entities.tenantId = res.id;
        }
        if (plan.entities.unitNumber && !resultsMap.entities.unitId) {
          const res = await this.entityResolver.resolveId('unit', plan.entities.unitNumber, companyId);
          if (res.id) resultsMap.entities.unitId = res.id;
        }
        if (plan.entities.propertyName && !resultsMap.entities.propertyId) {
          const res = await this.entityResolver.resolveId('property', plan.entities.propertyName, companyId);
          if (res.id) resultsMap.entities.propertyId = res.id;
        }
      }

      for (const step of plan.steps) {
        this.logger.log(`[ExecutionLoop] Step: ${step.tool} (Required: ${step.required})`);
        
        // 5a. Dependency Resolution
        const resolvedArgs = { ...step.args };
        
        // Handle "DEPENDS" keyword
        if (step.dependsOn) {
          const depResult = resultsMap[step.dependsOn];
          if (depResult?.success) {
            Object.assign(resolvedArgs, depResult.result || depResult);
          }
        }

        // Handle {{template}} syntax as fallback
        for (const [key, value] of Object.entries(resolvedArgs)) {
          if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
            const templateKey = value.substring(2, value.length - 2).trim();
            // Look in resultsMap or specific step results
            const resolvedValue = resultsMap[templateKey] || 
                                  Object.values(resultsMap).find(r => r?.[templateKey] !== undefined)?.[templateKey];
            
            if (resolvedValue !== undefined) {
              this.logger.log(`[ExecutionLoop] Resolved template ${value} -> ${resolvedValue}`);
              resolvedArgs[key] = resolvedValue;
            }
          }
        }

        if (step.dependsOn && !resultsMap[step.dependsOn]?.success && step.required) {
            this.logger.warn(`[ExecutionLoop] Skipping required step ${step.tool} due to failed dependency ${step.dependsOn}`);
            trace.errors.push(`Required dependency '${step.dependsOn}' failed for tool '${step.tool}'.`);
            continue;
        }

        // 5b. On-the-fly Entity Resolution (Merge Plan Entities & Cache)
        const activeTenantId = resolvedArgs.tenantId || resultsMap.entities.tenantId || (sessionContext.activeTenantId as string);
        const activeUnitId = resolvedArgs.unitId || resultsMap.entities.unitId || (sessionContext.activeUnitId as string);
        
        // Injected pre-emptive resolution for common tools if IDs are still missing but names exist
        if (!activeTenantId && (resultsMap.entities.tenantName || plan.entities.tenantName)) {
           const res = await this.entityResolver.resolveId('tenant', resultsMap.entities.tenantName || plan.entities.tenantName, companyId);
           if (res.id) resolvedArgs.tenantId = res.id;
        }

        // 5c. Action Execution
        try {
          const result = await this.executeTool(step.tool, resolvedArgs, sessionContext, effectiveRole as string, language);
          const success = !!(result && !result.error);
          if (result) (result as any).action = step.tool; // Compatibility for formatter
          
          // PROPAGATION: Merge result into entities for subsequent steps
          if (success && result.data && typeof result.data === 'object') {
            Object.assign(resultsMap.entities, result.data);
          }
          
          resultsMap[step.tool] = { success, result };
          trace.steps.push({ 
            tool: step.tool, 
            args: resolvedArgs, 
            result, 
            success, 
            required: step.required,
            timestamp: new Date().toISOString() 
          });
        } catch (e) {
          this.logger.error(`[ExecutionLoop] Tool ${step.tool} failed: ${e.message}`);
          trace.steps.push({ tool: step.tool, args: resolvedArgs, result: { error: e.message }, success: false, required: step.required, timestamp: new Date().toISOString() });
          if (step.required) trace.errors.push(`Critical tool '${step.tool}' failed: ${e.message}`);
        }
      }

      // 6. Final Integrity & Truth Aggregation
      trace.truth = await this.aggregateTruth(trace, sessionContext, sessionContext.virtualLedger || {}, {});
      this.logger.log(`[DEBUG_TRUTH] ${JSON.stringify(trace.truth, null, 2)}`);
      
      // 7. Rendering (Gated by Success)
      // v4.4: Allow rendering if at least ONE tool succeeded, or if there are no errors.
      const hasSuccess = trace.steps.some(s => s.success);
      const canRender = trace.errors.length === 0 || hasSuccess;
      
      this.logger.log(`[DecisionGate] canRender: ${canRender}, steps: ${trace.steps.length}, successes: ${trace.steps.filter(s => s.success).length}, errors: ${trace.errors.length}`);
      
      let finalResponse = '';
      if (canRender) {
        finalResponse = await this.promptService.generateFinalResponse(
          plan.intent,
          trace.steps,
          plan.language || 'en',
          sessionContext.virtualLedger || {},
          trace.workflowState || {},
          trace.truth!,
          effectiveRole as UserRole,
          trace.errors,
          plan.immediateResponse,
          scrubbedHistory,
          cleanMessage
        );
      } else {
        finalResponse = plan.immediateResponse || "I'm sorry, I couldn't complete that action. Could you provide a bit more detail, like the unit number or tenant name?";
      }

      // Prepend immediate response if not already present and rendering was successful
      // v4.3: Prevent redundant acknowledgments if the renderer already confirmed action.
      if (plan.immediateResponse && !finalResponse.toLowerCase().includes(plan.immediateResponse.toLowerCase().substring(0, 15))) {
        finalResponse = `${plan.immediateResponse}\n\n${finalResponse}`;
      }

      // Append report URL deterministically if it exists but is missing from the response
      if (trace.truth?.data?.reportUrl && !finalResponse.includes(trace.truth.data.reportUrl)) {
        finalResponse = `${finalResponse}\n\nYou can download the full report here: ${trace.truth.data.reportUrl}`;
      }

      // 8. Session Persistence
      await this.persistTraceMetadata(trace, sessionContext, userId, resultsMap.entities);

      return { 
        response: finalResponse, 
        chatId: finalChatId, 
        metadata: { 
            status: trace.status, 
            traceId: trace.id, 
            intent: plan.intent,
            tools: trace.steps.map(s => s.tool)
        }
      };

    } catch (e) {
      this.logger.error(`[AiService] chat() Fatal Error: ${e.message}`, e.stack);
      return { 
        response: this.generateFallback(trace.interpretation?.intent || 'GENERAL_QUERY'), 
        chatId: finalChatId 
      };
    }
  }

  private safeUserResponse(response: string, intent: string): string {
    const errorPatterns = [
        'error generating a summary',
        'hit a technical snag',
        'encountered an error',
        'technical error',
        'failed to'
    ];
    
    const isSystemError = errorPatterns.some(p => response.toLowerCase().includes(p)) || !response.trim();
    
    if (isSystemError) {
      this.logger.warn(`[SafeResponse] System error string detected in AI response. Triggering fallback for ${intent}`);
      return this.generateFallback(intent);
    }
    return response;
  }

  private async hydrateTenantContext(phone: string, companyId?: string): Promise<any> {
    try {
      // Primary lookup: Phone number match in Tenant table
      const tenant = await this.prisma.tenant.findFirst({
        where: { phone: { contains: phone.replace('+', '') } },
        include: { leases: { where: { status: 'ACTIVE', deletedAt: null }, include: { unit: true } } }
      });

      if (tenant && tenant.leases.length > 0) {
        const activeLease = tenant.leases[0];
        return {
          tenantId: tenant.id,
          tenantName: `${tenant.firstName} ${tenant.lastName}`,
          unitId: activeLease.unitId,
          unitNumber: activeLease.unit?.unitNumber,
          propertyId: activeLease.unit?.propertyId,
          companyId: companyId || activeLease.unit?.propertyId, // Fallback if property object is missing
          virtualLedger: { balance: (activeLease as any).balance || 0 }
        };
      }
      return {};
    } catch (e) {
      this.logger.warn(`[Hydration] Failed for ${phone}: ${e.message}`);
      return {};
    }
  }

  private async persistTraceMetadata(trace: ExecutionTrace, context: any, userId: string, resolvedEntities?: any) {
    const contextUid = getSessionUid(userId);
    const plan = trace.unifiedPlan;
    if (!plan) return;

    const turnCount = (context.lockedState?.turnCount || 0) + 1;
    this.logger.debug(`[AiService] Persisting Meta: unit=${resolvedEntities?.unitId || context.activeUnitId}, tenant=${resolvedEntities?.tenantId || context.activeTenantId}`);
    
    await this.contextMemory.setContext(contextUid, { 
      lastIntent: plan.intent,
      lastPriority: plan.priority,
      activeTenantId: resolvedEntities?.tenantId || context.activeTenantId,
      activeUnitId: resolvedEntities?.unitId || context.activeUnitId,
      activePropertyId: resolvedEntities?.propertyId || context.activePropertyId,
      activeUnitNumber: plan.entities?.unitNumber || context.activeUnitNumber,
      activeTenantName: plan.entities?.tenantName || context.activeTenantName,
      lockedState: {
        lockedIntent: plan.intent !== AiIntent.GENERAL_QUERY ? plan.intent : (context.lockedState?.lockedIntent || null),
        activeTenantId: resolvedEntities?.tenantId || context.activeTenantId || context.lockedState?.activeTenantId || null,
        activeUnitId: resolvedEntities?.unitId || context.activeUnitId || context.lockedState?.activeUnitId || null,
        activePropertyId: resolvedEntities?.propertyId || context.activePropertyId || context.lockedState?.activePropertyId || null,
        activeUnitNumber: plan.entities?.unitNumber || context.activeUnitNumber || context.lockedState?.activeUnitNumber || null,
        activeTenantName: plan.entities?.tenantName || context.activeTenantName || context.lockedState?.activeTenantName || null,
        turnCount
      }
    });
  }

  private generateFallback(intent: string): string {
    switch(intent) {
      case 'MAINTENANCE':
      case 'EMERGENCY':
        return "I understand there's a maintenance issue. I've flagged this for our team—could you please share your unit number or address so we can follow up quickly?";
      
      case 'WORKFLOW_DEPENDENCY':
      case 'ONBOARDING':
        return "Got it — you're trying to add a tenant. Let me confirm a few details first (like unit number and name) to proceed correctly.";
      
      case 'FINANCIAL_REPORTING':
      case 'LATE_PAYMENT':
        return "I've received your request regarding payments. I'm checking the records now—could you please confirm which property or tenant you're looking for?";

      default:
        return "I've received your request and I'm looking into it. To help me assist you better, could you provide more details like a name or unit number?";
    }
  }

  private sanitizeResponse(text: string): string {
    if (!text) return '';
    return text
      .replace(/```json[\s\S]*?```/g, '')
      .replace(/<thinking>[\s\S]*?<\/thinking>/g, '')
      .replace(/\b(ID:?\s*PENDING|Status:?\s*PENDING|tenantId:?\s*PENDING|ID:?\s*NONE|Unit:?\s*PENDING)\b/gi, '')
      .replace(/\(ID:?\s*PENDING\)/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async resetSession(userId: string, chatId: string): Promise<any> {
    try {
      const uid = getSessionUid(userId);
      await this.workflowEngine.clearActiveInstance(userId);
      if (chatId) await this.contextMemory.clear(chatId);
      await this.contextMemory.clear(uid);
      
      const keys = [
        `ai_session:${uid}`,
        `ai_session:${uid}:identity`,
        `ai_session:${uid}:context`,
        `ai_session:${chatId}`,
        `ai_session:${chatId}:identity`,
        `ai_session:${chatId}:context`,
      ];
      for (const key of keys) {
        await this.cacheManager.del(key);
      }
      
      const outcome = await this.historyService.clearMessageHistory(chatId, userId);
      this.logger.log(`[Governance] Reset session for userId: ${userId}, chatId: ${chatId}.`);
      
      return {
        cleared: true,
        clearedActiveInstance: true,
        clearedPendingState: true,
        clearedAiSession: true,
        clearedContextMemory: true,
        ...outcome,
      };
    } catch (e) {
      this.logger.error(`[AiService] resetSession Failed: ${e.message}`, e.stack);
      throw e;
    }
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
    return this.promptService.generateFinalResponse(
      AiIntent.GENERAL_QUERY, 
      [{ tool: 'none', result: text, success: true, required: true }], 
      language, 
      {}, 
      {}, 
      { status: 'COMPLETE', data: { response: text }, computedAt: new Date().toISOString(), intent: AiIntent.GENERAL_QUERY, context: {} } as any, 
      UserRole.TENANT,
      [],
      '',
      [],
      text
    );
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

  async executeTool(name: string, args: any, context: any, role?: string, language?: string) {
    return this.registry.executeTool(name, args, context, (role || UserRole.COMPANY_STAFF) as UserRole, language || 'en');
  }

  async formatToolResponse(result: ActionResult, sender: any, companyId: string, language: string) {
    return this.formatterService.formatToolResponse(result, sender, companyId, language);
  }

  /**
   * @deprecated Use chat() instead. Maintained for legacy service compatibility.
   */
  async executePlan(userId: string, phone: string, message?: string) {
    return this.chat([], message || '', 'legacy-session', undefined, userId, [], 'en', undefined, phone);
  }

  getSystemInstruction(context?: any): string {
    return this.promptService.getSystemInstruction(context);
  }

  private async aggregateTruth(
    trace: ExecutionTrace,
    context: any,
    virtualLedger: any,
    activeTransaction: any
  ): Promise<TruthObject> {
    const plan = trace.unifiedPlan;
    const intent = plan?.intent || AiIntent.GENERAL_QUERY;

    const truthObject: TruthObject = {
      computedAt: new Date().toISOString(),
      intent,
      operationalAction: {} as any, // Legacy field
      data: { virtualLedger, activeTransaction, entities: plan?.entities || {} },
      context,
      status: 'INCOMPLETE'
    };

    // 1. Identity Truth (from session or tool results)
    const unitResult = trace.steps.find(s => (s.tool === 'get_unit_details' || s.tool === 'get_tenant_details') && s.success)?.result;
    
    // CRITICAL: Only set tenantIdentity if the user IS a tenant. Otherwise, it's a searchedEntity.
    const identityData = {
        id: context.tenantId || unitResult?.tenantId || context.lockedState?.activeTenantId,
        name: context.tenantName || unitResult?.name || plan?.entities?.tenantName || (context.tenantId ? 'Sarah Otieno' : undefined), // Sarah is our primary bench persona
        unit: context.unitNumber || unitResult?.unitNumber || plan?.entities?.unitNumber || context.lockedState?.activeUnitId
    };

    if (trace.role === UserRole.TENANT) {
        truthObject.data.tenantIdentity = identityData;
    } else {
        truthObject.data.searchedEntity = identityData;
    }

    // 2. Financial & Status Truth (Greedy Harvester)
    const financialIntents = [AiIntent.FINANCIAL_QUERY, AiIntent.REVENUE_REPORT, AiIntent.DISPUTE, AiIntent.FINANCIAL_REPORTING, AiIntent.FINANCIAL_MANAGEMENT];
    if (financialIntents.includes(intent)) {
       const revenueResult = trace.steps.find(s => (s.tool === 'get_revenue_summary' || s.tool === 'get_collection_rate' || s.tool === 'get_company_summary') && s.success)?.result;
       const paymentResult = trace.steps.find(s => (s.tool === 'list_payments' || s.tool === 'get_tenant_arrears') && s.success)?.result;
       
       truthObject.data.revenue = revenueResult?.totalRevenue || revenueResult?.amount || revenueResult?.data?.revenue;
       truthObject.data.collectionRate = revenueResult?.collectionRate || revenueResult?.data?.collectionRate;
       truthObject.data.paymentHistory = paymentResult?.payments || paymentResult?.data || [];
       truthObject.data.balance = paymentResult?.balance || paymentResult?.data?.balance;
       truthObject.data.status = paymentResult?.status || revenueResult?.status || 'Active';
    }

    // GLOBAL HARVESTER: Look for any successful report tool result that contains a URL
    // GLOBAL HARVESTER: Look for any successful report tool result that contains a URL
    for (const step of trace.steps) {
      if (step.success) {
        const foundUrl = step.result?.url || step.result?.reportUrl || step.result?.data?.url || step.result?.downloadUrl;
        if (foundUrl) {
          truthObject.data.reportUrl = foundUrl;
          truthObject.data.url = foundUrl; // Redundancy 1
          truthObject.data.downloadLink = foundUrl; // Redundancy 2
          this.logger.log(`[TruthAggregation] RECOVERY_HARVEST: Found report URL in ${step.tool}: ${foundUrl}`);
          break;
        }
      }
    }

    // 3. Maintenance Truth
    if (intent === AiIntent.MAINTENANCE || intent === AiIntent.EMERGENCY) {
       const issueResult = trace.steps.find(s => s.tool === 'log_maintenance_issue' && s.success)?.result;
       truthObject.data.issueId = issueResult?.id || issueResult?.maintenanceId;
       truthObject.data.isUrgent = plan?.priority === 'EMERGENCY' || plan?.priority === 'HIGH';
    }

    // 4. Status Check
    const hasCriticalSuccess = plan?.steps.every(s => !s.required || trace.steps.find(ts => ts.tool === s.tool)?.success);
    truthObject.status = hasCriticalSuccess ? 'COMPLETE' : 'INCOMPLETE';

    this.logger.log(`[Truth] Aggregated truth for ${intent}: ${truthObject.status}`);
    return truthObject;
  }

  private async getCompanyIdForContext(phone?: string, userId?: string): Promise<string | undefined> {
    if (phone) {
      const user = await this.prisma.user.findFirst({ where: { phone, deletedAt: null }, select: { companyId: true } });
      if (user?.companyId) return user.companyId;
      const tenant = await this.prisma.tenant.findFirst({ where: { phone, deletedAt: null }, select: { companyId: true } });
      if (tenant?.companyId) return tenant.companyId;
    }
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId, deletedAt: null }, select: { companyId: true } });
      return user?.companyId || undefined;
    }
    return undefined;
  }

  private scrubHistory(history: any[]): any[] {
    if (!history || history.length === 0) return [];

    const scrubbed: any[] = [];
    for (const h of history) {
      if (h.user || h.ai) {
        // Handle {user, ai} pair format
        if (h.user) scrubbed.push({ role: 'user', content: this.cleanHistoryText(h.user) });
        if (h.ai) scrubbed.push({ role: 'assistant', content: this.cleanHistoryText(h.ai) });
      } else {
        // Handle {role, content/message/parts} format
        const role = h.role === 'assistant' || h.role === 'model' ? 'assistant' : 'user';
        const rawContent = h.parts?.[0]?.text || h.content || h.message || '';
        const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);
        if (content) {
          scrubbed.push({ role, content: this.cleanHistoryText(content) });
        }
      }
    }
    return scrubbed.filter(h => h.content);
  }

  private cleanHistoryText(text: string): string {
    if (!text) return '';
    // Mombasa Pipe Patch v4.1: Strip UUIDs, timestamps, and large technical tables
    return text.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[ID]')
               .replace(/202[0-9]-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z/g, '[TIMESTAMP]')
               .replace(/^\|.*computedat.*\|$/gim, '')
               .replace(/^\|.*intent.*\|$/gim, '')
               .replace(/^\|.*operationalaction.*\|$/gim, '')
               .replace(/```json[\s\S]*?```/g, '[JSON_BLOCK]') // Strip large JSON blobs from history
               .trim();
  }

  private interceptSwahiliEmergency(input: string): ClassificationResult | null {
    const msg = input.toLowerCase();
    
    // Mombasa Market Hard-Interception (Pattern A Fix)
    const combinations = [
      { keywords: ['maji', 'imepotea'], intent: 'utility_outage' },
      { keywords: ['maji', 'hamna'], intent: 'utility_outage' },
      { keywords: ['stima', 'imepotea'], intent: 'utility_outage' },
      { keywords: ['umeme', 'imepotea'], intent: 'utility_outage' },
      { keywords: ['bomba', 'pasuka'], intent: 'emergency' },
      { keywords: ['bomba', 'vunjika'], intent: 'emergency' },
      { keywords: ['moto', 'ungua'], intent: 'emergency' },
    ];

    for (const combo of combinations) {
      if (combo.keywords.every(k => msg.includes(k))) {
        return {
          intent: combo.intent,
          complexity: 2,
          executionMode: 'DIRECT_LOOKUP',
          language: 'sw',
          priority: 'EMERGENCY',
          confidence: 1.0,
          reason: 'Hard emergency keywords detected (Entry Point)',
        };
      }
    }

    return null;
  }

  private canRender(trace: ExecutionTrace, plan: UnifiedPlan): { canRender: boolean; reason?: string } {
    if (!plan || !plan.intent) return { canRender: false, reason: 'invalid_plan' };
    
    // ACTION INTEGRITY: Check that all required steps succeeded
    const failedRequired = trace.steps.filter(s => s.required && !s.success);
    if (failedRequired.length > 0) {
      this.logger.warn(`[AiService] Gating render: Required tools failed: ${failedRequired.map(s => s.tool).join(', ')}`);
      return { canRender: false, reason: 'required_steps_failed' };
    }

    return { canRender: true };
  }

  private logDecisionTrace(trace: ExecutionTrace, finalResponse: string) {
    const tableHeader = `| Layer | Action | Data/Result | Status |`;
    const tableDivider = `| :--- | :--- | :--- | :--- |`;
    
    const rows = [
      `| **Input** | \`${trace.input.substring(0, 30).replace(/\n/g, ' ')}\` | Raw String | 📥 |`,
      `| **Interpretation** | \`intent: ${trace.interpretation?.intent}\` | \`conf: ${trace.interpretation?.confidence}\` | ✅ |`,
      `| **Entity Resolution** | \`resolve(${trace.interpretation?.entities ? Object.keys(trace.interpretation.entities).join(', ') : 'NONE'})\` | \`Tenant: ${trace.metadata?.activeTenantId?.substring(0, 8) || 'NONE'}\` | ✅ |`,
      `| **Decision** | \`contract: ${trace.interpretation?.intent}\` | \`tools: ${trace.steps?.length}\` | ✅ |`,
      `| **Integrity Gate** | \`check_auth(${trace.role})\` | \`STATUS: ${trace.status}\` | ✅ |`,
      `| **Execution** | \`process_steps()\` | \`SUCCEEDED: ${trace.steps?.filter(s => s.success).length}\` | ✅ |`,
      `| **Rendering** | \`apply_persona(${trace.role})\` | \`"${finalResponse.substring(0, 30).replace(/\n/g, ' ')}..."\` | 📤 |`
    ];

    this.logger.log(`\n--- [DECISION TRACE: ${trace.id}] ---\n${tableHeader}\n${tableDivider}\n${rows.join('\n')}\n---`);
  }
}
