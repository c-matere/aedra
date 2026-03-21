import {
  Injectable,
  Logger,
  Inject,
  BadRequestException,
  forwardRef,
  OnModuleInit,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { BASE_MODEL, buildTools, buildModels, allToolDeclarations } from './ai.tools';
import Groq, { toFile } from 'groq-sdk';
import { PrismaService } from '../prisma/prisma.service';
import { writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { join } from 'path';
import * as fs from 'fs';
import { WorkflowEngine } from '../workflows/workflow.engine';
import { WorkflowBridgeService } from './workflow-bridge.service';
import { QuorumBridgeService } from './quorum-bridge.service';
import { routeWorkflowRequest } from '../workflows/workflow.router';
import { tenantContext } from '../common/tenant-context';
import { UserRole } from '../auth/roles.enum';
import { selectModelKey } from './ai.router';
import { EmbeddingsService } from './embeddings.service';
import { withRetry } from '../common/utils/retry';
import { CriticService } from './critic.service';
import { SKILLS_REGISTRY } from './skills.registry';
import { ResponsePipelineService } from './response-pipeline.service';
import {
  AiClassifierService,
  ClassificationResult,
} from './ai-classifier.service';
import { UnitsService } from '../units/units.service';
import { TemporalContextService } from './temporal-context.service';
import { QueryEnrichmentService } from './query-enrichment.service';
import { AuditLogService } from '../audit/audit-log.service';
import { getPersonaByRole, MASTER_PERSONAS } from './persona.registry';
import { SystemDegradationService } from './system-degradation.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AI_BACKGROUND_QUEUE } from './ai.constants';
import { AiQuotaService } from './ai-quota.service';
import {
  selectTools,
  ConversationContext,
  TOOL_ENTITY_MAP,
  getSessionUid,
} from './ai-tool-selector.util';
import { ErrorRecoveryService } from './error-recovery.service';
import {
  NextStepOrchestrator,
  ActionResult,
} from './next-step-orchestrator.service';
import { AiToolRegistryService } from './ai-tool-registry.service';
import { getSkillByIntent } from './skills.registry';
import { AiWhatsappOrchestratorService } from './ai-whatsapp-orchestrator.service';
import { WhatsAppFormatterService } from './whatsapp-formatter.service';
import { WhatsappService } from '../messaging/whatsapp.service';
import * as formatters from './ai.formatters';

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private genAI: GoogleGenerativeAI;
  private groq: Groq;
  private models: Record<'read' | 'write' | 'report' | 'gemma', any>;
  private readonly fallbackModel =
    (process.env.GEMINI_MODEL || '').trim() || 'gemini-1.5-flash';
  private readonly primaryModel = 'llama-3.1-8b-instant';
  private readonly llamaModel = 'llama-3.1-8b-instant';
  private modelName = this.primaryModel;
  private modelsReady: Promise<void>;
  private isInitializing = false;
  private modelsVerified = false;

  private recentToolCalls = new Map<
    string,
    { timestamp: number; result: any }
  >();

  private openerPool: string[] = [
    'Habari! Nipo hapa kukusaidia...',
    'Hello! How can I assist you today?',
  ];
  private closerPool: string[] = [
    'Je, kuna lingine?',
    'Anything else I can help with?',
  ];
  private toolTemperature = 0.0;
  private chatTemperature = 0.7;
  private toolPresencePenalty = 0.0;
  private chatPresencePenalty = 0.0;
  private historyLimit = 50;
  private systemInstruction = `You are "Aedra", the virtual co-worker for property management professionals.
    
    1. PROACTIVE PLANNING: For complex multi-step tasks, FIRST call generate_execution_plan. Present this plan to the user clearly.
    2. SEQUENTIAL EXECUTION: Proceed logically. If you have data for the next step, EXECUTE it immediately.
    3. WHATSAPP MEDIUM: Format lists with bullet points. NEVER use Markdown tables. WhatsApp does not support tables; use structured bullet points instead. NEVER output raw JSON, technical data structures, or IDs unless explicitly asked for a raw identifier. Always translate tool results into natural, conversational language.
    4. SWAHILI SUPPORT: Respond in Swahili only if the user's message is in Swahili.
    5. IDENTITY: You are "Aedra", a strategic property management intelligence system.
    6. PROACTIVE: If you find data, summarize it strategically. Don't just list it.
    7. ALWAYS use available tools to fulfill requests. If you cannot fulfill a request with the available tools, state that clearly and suggest a manual alternative.`;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly embeddings: EmbeddingsService,
    @Inject(forwardRef(() => WhatsappService))
    private readonly whatsappService: WhatsappService,
    private readonly responsePipeline: ResponsePipelineService,
    private readonly critic: CriticService,
    private readonly classifier: AiClassifierService,
    private readonly unitsService: UnitsService,
    private readonly auditLog: AuditLogService,
    private readonly systemDegradation: SystemDegradationService,
    @InjectQueue(AI_BACKGROUND_QUEUE) private readonly backgroundQueue: Queue,
    private readonly quotaService: AiQuotaService,
    private readonly recovery: ErrorRecoveryService,
    private readonly orchestrator: NextStepOrchestrator,
    private readonly registry: AiToolRegistryService,
    private readonly whatsappOrchestrator: AiWhatsappOrchestratorService,
    private readonly enrichment: QueryEnrichmentService,
    private readonly workflowEngine: WorkflowEngine,
    @Inject(forwardRef(() => WorkflowBridgeService))
    private readonly workflowBridge: WorkflowBridgeService,
    private readonly quorumBridge: QuorumBridgeService,
    private readonly whatsappFormatter: WhatsAppFormatterService,
  ) {
    this.genAI = new GoogleGenerativeAI(
      process.env.GEMINI_API_KEY || 'dummy-key',
    );
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'dummy-key' });

    this.openerPool =
      this.parsePool(process.env.AI_OPENER_POOL) || this.openerPool;
    this.closerPool =
      this.parsePool(process.env.AI_CLOSER_POOL) || this.closerPool;
    this.toolTemperature = this.parseNum(
      process.env.AI_TOOL_TEMP,
      this.toolTemperature,
    );
    this.chatTemperature = this.parseNum(
      process.env.AI_CHAT_TEMP,
      this.chatTemperature,
    );
    this.toolPresencePenalty = this.parseNum(
      process.env.AI_TOOL_PRESENCE,
      this.toolPresencePenalty,
    );
    this.chatPresencePenalty = this.parseNum(
      process.env.AI_CHAT_PRESENCE,
      this.chatPresencePenalty,
    );
    this.historyLimit = this.parseNum(process.env.AI_HISTORY_LIMIT, 50);

    this.modelsReady = this.initModels();
  }

  getSystemInstruction(): string {
    return this.systemInstruction;
  }

  private parsePool(val?: string): string[] | undefined {
    if (!val) return undefined;
    return val
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private parseNum(val: string | undefined, def: number): number {
    if (!val) return def;
    const n = parseFloat(val);
    return isNaN(n) ? def : n;
  }

  private async initModels() {
    if (this.isInitializing) return this.modelsReady;
    this.isInitializing = true;
    try {
      this.models = await buildModels(
        this.genAI,
        this.getSystemInstruction(),
        this.modelName,
      );
      this.logger.log('AI models initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize AI models', error.stack);
    } finally {
      this.isInitializing = false;
    }
  }

  async onModuleInit() {
    await this.modelsReady;
    this.verifyHealth();
    
    // ENSURE WORKFLOW handlers are wired
    if (this.workflowBridge) {
      this.workflowEngine.setHandlers(this.workflowBridge);
      this.logger.log('Workflow handlers wired (AiService onModuleInit)');
    }
  }

  private async verifyHealth() {
    if (this.modelsVerified) return;
    try {
      // Check primary model (Groq) — allow 2 retries for cold-start DNS delays
      await withRetry(
        () =>
          this.groq.chat.completions.create({
            model: this.primaryModel,
            messages: [{ role: 'user', content: 'health check' }],
            max_tokens: 1,
          }),
        { maxRetries: 2, initialDelay: 2000, retryableStatuses: [] },
      );
      this.modelsVerified = true;
      this.logger.log(
        `[HealthCheck] AI Model ${this.primaryModel} verified successfully.`,
      );
    } catch (e) {
      this.logger.warn(
        `[HealthCheck] Primary model ${this.primaryModel} check failed: ${e.message}. Falling back to Gemini...`,
      );
      try {
        const model = this.genAI.getGenerativeModel({
          model: this.fallbackModel,
        });
        await withRetry(() => model.generateContent('health check'), {
          maxRetries: 1,
        });
        this.modelsVerified = true;
        this.logger.log(
          `[HealthCheck] Fallback Model ${this.fallbackModel} verified successfully.`,
        );
        this.modelName = this.fallbackModel;
      } catch (fe) {
        this.logger.error(
          `[HealthCheck] All AI Models verification failed: ${fe.message}`,
        );
        this.modelsVerified = true;
      }
    }
  }
  private normalizeHistory(history: any[]): any[] {
    if (!history || !Array.isArray(history)) return [];
    return history.map((h) => {
      const role = h.role === 'assistant' ? 'model' : h.role || 'user';
      if (h.parts) return { role, parts: h.parts };

      const content = h.content || h.message || '';
      return {
        role,
        parts: [{ text: content }],
      };
    });
  }

  private normalizeHistoryForOpenAI(history: any[]): any[] {
    const messages: any[] = [];
    for (const turn of history) {
      const role =
        turn.role === 'model' || turn.role === 'assistant'
          ? 'assistant'
          : turn.role === 'function'
            ? 'tool'
            : 'user';

      if (role === 'user') {
        const text =
          turn.parts
            ?.map((p: any) => p.text)
            .filter(Boolean)
            .join('\n') ||
          turn.content ||
          '';
        if (text) messages.push({ role: 'user', content: text });
      } else if (role === 'assistant') {
        const text =
          turn.parts
            ?.map((p: any) => p.text)
            .filter(Boolean)
            .join('\n') ||
          turn.content ||
          '';
        const toolCalls = turn.parts
          ?.filter((p: any) => p.functionCall)
          .map((p: any, idx: number) => ({
            id: `hist_${messages.length}_${idx}`,
            type: 'function',
            function: {
              name: p.functionCall.name,
              arguments: JSON.stringify(p.functionCall.args),
            },
          }));

        messages.push({
          role: 'assistant',
          content: text || '',
          tool_calls: toolCalls?.length > 0 ? toolCalls : undefined,
        });
      } else if (role === 'tool') {
        // Find the previous assistant message to match IDs by tool name
        const prevAssistant = [...messages]
          .reverse()
          .find((m) => m.role === 'assistant' && m.tool_calls);
        turn.parts?.forEach((p: any, idx: number) => {
          if (p.functionResponse) {
            const callId =
              prevAssistant?.tool_calls?.find(
                (tc: any) => tc.function.name === p.functionResponse.name,
              )?.id || `hist_call_${idx}`;
            messages.push({
              role: 'tool',
              tool_call_id: callId,
              content: JSON.stringify(p.functionResponse.response),
            });
          }
        });
      }
    }
    return messages;
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
    generatedFiles?: any[];
    interactive?: any;
    vcSummary?: any;
    requires_authorization?: boolean;
    actionId?: string;
  }> {
    const normalizedHistory = this.normalizeHistory(history);
    await this.modelsReady;
    if (!this.models) {
      // Safety net: ensure models are initialized even if initModels failed earlier
      this.models = await buildModels(
        this.genAI,
        this.getSystemInstruction(),
        this.modelName,
      );
    }
    if (!this.modelsVerified) await this.verifyHealth();

    const store = tenantContext.getStore() as any;
    const role = store?.role || UserRole.COMPANY_STAFF;
    const userId = store?.userId;
    let finalCompanyId = companyId || store?.companyId;

    if (!finalCompanyId && role === UserRole.SUPER_ADMIN) {
      // Platform-level user needs a target context for workflows
      const defaultCompany = await this.prisma.company.findFirst({
        where: { isActive: true },
        select: { id: true },
      });
      finalCompanyId = defaultCompany?.id;
      this.logger.log(
        `[AiService] Super Admin active without companyId. Defaulting to: ${finalCompanyId || 'NONE'}`,
      );
    }

    const finalChatId =
      chatId || (await this.getOrCreateChat(userId, finalCompanyId));
    const lang = language || 'en';

    const context: any = {
      role,
      userId,
      companyId: finalCompanyId,
      chatId: finalChatId,
      jobId,
      isSuperAdmin: role === UserRole.SUPER_ADMIN,
      phone,
    };

    const enrichedMessage = await this.enrichment.enrich(
      message,
      normalizedHistory,
      context,
    );
    const finalMessage = enrichedMessage || message;

    // Save attachments to disk so tools can access them
    const savedPaths = await this.saveAttachments(
      attachments || [],
      finalChatId,
    );

    // Contextual Vision Recovery: if no new attachments, check for very recent ones in this chat
    let effectiveAttachments = attachments || [];
    if (effectiveAttachments.length === 0) {
      effectiveAttachments = await this.recoverRecentAttachments(finalChatId);
      this.logger.log(
        `[AiService] Recovered ${effectiveAttachments.length} recent attachments for chat ${finalChatId}`,
      );
    }

    if (savedPaths.length > 0) {
      context['savedAttachments'] = savedPaths;
    }

    // 2. Intent Classification (if not provided by caller)
    let finalClassification = classification;
    if (!finalClassification) {
      const historyStrings = history
        .slice(-5)
        .map((h) => h.content || h.message || '');
      finalClassification = await this.classifier.classify(
        finalMessage,
        role,
        historyStrings,
        attachments?.length || 0,
      );
    }

    const intent = finalClassification.intent || 'read';
    const mode = finalClassification.executionMode || 'LIGHT_COMPOSE';

    this.logger.log(
      `[AiService] Final Classification: intent=${intent}, mode=${mode}, reason=${finalClassification.reason}`,
    );
    this.logger.log(
      `[AiService] Incoming chat request: chatId=${finalChatId}, role=${role}, message="${message.slice(0, 100)}..."`,
    );

    // Persist the user message immediately
    await this.prisma.chatMessage.create({
      data: {
        chatHistoryId: finalChatId,
        role: 'user',
        content: message,
      },
    });

    // 3. Workflow Routing
    const workflowResult = await routeWorkflowRequest(this.workflowEngine, {
      userId: context.userId,
      message: finalMessage,
      intent,
      context: { ...context, chatId: finalChatId },
      agentFallback: async () => {
        if (mode === 'PLANNING') {
          this.logger.log(
            `[AiService] Entering specialized PLANNING flow for complex request.`,
          );
          return this.handlePlanningFlow(
            finalChatId,
            finalMessage,
            normalizedHistory,
            context,
            lang,
            finalClassification,
            effectiveAttachments,
          );
        }

        // Original LLM Tool Loop logic (using same mode check)
        if (
          mode === 'INTELLIGENCE' ||
          mode === 'ORCHESTRATED' ||
          mode === 'LIGHT_COMPOSE' ||
          mode === 'DIRECT_LOOKUP'
        ) {
          this.logger.log(
            `[AiService] Entering multi-turn tool loop for mode: ${mode}`,
          );
          const safeIntent = (
            ['read', 'write', 'report'].includes(intent) ? intent : 'read'
          ) as 'read' | 'write' | 'report';

          // Force the model to remember it HAS tools and should USE them.
          let enhancedMessage = `[CAPABILITY_REMINDER] You have full access to property management tools (read/write/report). NEVER say you lack functionality. If you need data, CALL A TOOL.`;

          if (context.savedAttachments?.length > 0) {
            enhancedMessage += `\n\n[LOCAL_FILES_NOTIFICATION] I have saved your uploaded file(s) to the server. You can find them at:\n${context.savedAttachments.map((p: string) => `- ${p}`).join('\n')}\nUSE the 'run_python_script' tool to read and process these files.`;
          }

          enhancedMessage += `\n\nUser Request: ${finalMessage}`;
          const hasAttachments = effectiveAttachments.length > 0;
          const isLongContent = finalMessage.length > 300; 
          const isHeavyRequest = hasAttachments || isLongContent;

          let currentModel = isHeavyRequest ? this.primaryModel : this.llamaModel;
          this.logger.log(`[AiService] Escalation Strategy: initial=${currentModel}, heavy=${isHeavyRequest}`);

          try {
            // Stage 1: Llama 8B (First line of defense for light requests)
            if (currentModel === this.llamaModel) {
              try {
                this.logger.log(`[AiService] Stage 1 (Llama 8B) starting...`);
                return await this.executeGroqToolLoop(
                  finalChatId,
                  enhancedMessage,
                  normalizedHistory,
                  safeIntent,
                  context,
                  lang,
                  finalClassification,
                  effectiveAttachments,
                  this.llamaModel,
                );
              } catch (llamaErr) {
                this.logger.warn(`[AiService] Stage 1 (Llama 8B) failed: ${llamaErr.message}. Escalating to Stage 2...`);
                currentModel = this.primaryModel;
              }
            }

            // Stage 2: GPT OSS 20B (Standard or heavy fallback)
            if (currentModel === this.primaryModel) {
              this.logger.log(`[AiService] Stage 2 (GPT OSS 20B) starting...`);
              return await this.executeGroqToolLoop(
                finalChatId,
                enhancedMessage,
                normalizedHistory,
                safeIntent,
                context,
                lang,
                finalClassification,
                effectiveAttachments,
                this.primaryModel,
              );
            }
          } catch (groqErr) {
            this.logger.error(`[AiService] Groq escalation chain failed: ${groqErr.message}. Falling back to Gemini...`);
          }

          // Final Stage: Gemini (Last line of defense)
          this.logger.log(`[AiService] Final Stage (Gemini) starting...`);
          return this.executeGeminiToolLoop(
            finalChatId,
            enhancedMessage,
            normalizedHistory,
            safeIntent,
            context,
            lang,
            finalClassification,
            effectiveAttachments,
          );
        }
        return null;
      },
    });

    if (workflowResult && workflowResult.instanceId) {
      const currentStep = workflowResult.currentState;
      const responseText = `[Workflow: ${workflowResult.workflowId}] Current State: ${currentStep}\n\nI have initiated the multi-step process for your request. I will notify you as soon as the next step is ready.`;

      await this.prisma.chatMessage.create({
        data: {
          chatHistoryId: finalChatId,
          role: 'assistant',
          content: responseText,
        },
      });

      return {
        response: responseText,
        chatId: finalChatId,
      };
    }

    if (workflowResult) return workflowResult;

    const route = await selectModelKey(
      this.genAI,
      finalMessage,
      normalizedHistory,
      this.modelName,
      this.groq,
    );

    const hasImages = attachments?.some((a) => a.mimeType?.startsWith('image/'));

    if (hasImages) {
      this.logger.log(`[AiService.chat] Forcing Gemini loop for multi-modal request.`);
      return await this.executeGeminiToolLoop(
        finalChatId,
        finalMessage,
        normalizedHistory,
        (['read', 'write', 'report'].includes(classification?.intent || '')
          ? (classification?.intent as any)
          : 'read') as 'read' | 'write' | 'report',
        context,
        lang,
        classification,
        attachments,
      );
    }

    let response = '';
    try {
      if (this.modelName === this.primaryModel) {
        const groqChat = await this.groq.chat.completions.create({
          model: this.primaryModel,
          messages: [
            {
              role: 'system' as any,
              content: await this.buildSystemMessage(
                finalMessage,
                context,
                lang,
                classification,
              ),
            },
            ...normalizedHistory.map((h) => ({
              role: (h.role === 'model' ? 'assistant' : 'user') as any,
              content: h.parts?.[0]?.text || '',
            })),
            { role: 'user' as any, content: finalMessage },
          ],
          temperature: 0.7,
        });
        response = groqChat.choices[0]?.message?.content || '';
      }
    } catch (e) {
      this.logger.warn(
        `Primary chat failed: ${e.message}. Falling back to Gemini...`,
      );
    }

    if (!response) {
      const systemMessage = await this.buildSystemMessage(
        finalMessage,
        context,
        lang,
        classification,
      );

      const prunedDecls = selectTools(
        classification?.intent || 'unknown',
        getPersonaByRole(context.role),
        allToolDeclarations,
      );

      const model = this.genAI.getGenerativeModel({
        model: this.modelName || BASE_MODEL,
        tools: buildTools(prunedDecls) as any,
        systemInstruction: systemMessage,
      });

      const chat = model.startChat({ history: normalizedHistory });
      const result: any = await withRetry(() =>
        chat.sendMessage(finalMessage),
      );
      response = result?.response?.text
        ? result.response.text()
        : result?.text
          ? result.text()
          : '';
    }

    await this.prisma.chatMessage.create({
      data: {
        chatHistoryId: finalChatId,
        role: 'assistant',
        content: response,
      },
    });

    return { response, chatId: finalChatId };
  }

  private async getOrCreateChat(
    userId: string,
    companyId: string,
  ): Promise<string> {
    const lastChat = await this.prisma.chatHistory.findFirst({
      where: { userId, companyId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });

    if (
      lastChat &&
      Date.now() - lastChat.updatedAt.getTime() < 30 * 60 * 1000
    ) {
      return lastChat.id;
    }

    const newChat = await this.prisma.chatHistory.create({
      data: { userId, companyId: companyId as any },
    });
    return newChat.id;
  }

  async executeTool(
    name: string,
    args: any,
    context: any,
    language: string = 'en',
  ): Promise<ActionResult> {
    const role = context.role || UserRole.COMPANY_STAFF;
    const t0 = Date.now();
    const cacheKey = `tool:${name}:${JSON.stringify(args)}:${context.userId}`;

    const recent = this.recentToolCalls.get(cacheKey);
    if (recent && Date.now() - recent.timestamp < 10000) {
      return { success: true, data: recent.result, action: name };
    }

    try {
      const data = await this.registry.executeTool(
        name,
        args,
        context,
        role,
        language,
      );
      if (data?.error)
        return { success: false, data: null, error: data.error, action: name };

      if (data?.requires_authorization) {
        return {
          success: false,
          data: null,
          action: name,
          requires_authorization: true,
          actionId: data.actionId,
        };
      }

      this.recentToolCalls.set(cacheKey, {
        timestamp: Date.now(),
        result: data,
      });
      this.logger.log(`Tool ${name} executed in ${Date.now() - t0}ms`);
      return { success: true, data, action: name };
    } catch (error) {
      this.logger.error(`Error executing tool ${name}: ${error.message}`);
      return { success: false, data: null, error: error.message, action: name };
    }
  }

  async deleteChatSession(chatId: string) {
    return await this.prisma.chatHistory.update({
      where: { id: chatId },
      data: { deletedAt: new Date() },
    });
  }

  async getCollectionRate(companyId: string): Promise<number> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );

      const [totalInvoiced, totalPaid] = await Promise.all([
        this.prisma.invoice.aggregate({
          where: {
            lease: { property: { companyId, deletedAt: null } },
            createdAt: { gte: startOfMonth, lte: endOfMonth },
            deletedAt: null,
          },
          _sum: { amount: true },
        }),
        this.prisma.payment.aggregate({
          where: {
            lease: { property: { companyId, deletedAt: null } },
            paidAt: { gte: startOfMonth, lte: endOfMonth },
            deletedAt: null,
          },
          _sum: { amount: true },
        }),
      ]);

      const invoiced = totalInvoiced._sum.amount || 0;
      const paid = totalPaid._sum.amount || 0;

      if (invoiced <= 0) return 0;
      return Math.round((paid / invoiced) * 100);
    } catch (e) {
      this.logger.error(`[getCollectionRate] Failed: ${e.message}`);
      return 0;
    }
  }

  async formatToolResponse(
    result: any,
    sender: any,
    companyId: string,
    language: string,
  ): Promise<{ text: string; interactive?: any }> {
    if (!result.success) {
      const recovery = this.recovery.buildInteractiveErrorRecovery(
        result.action,
        new Error(result.error),
        { userId: sender.id },
        language as any,
      );
      await this.cacheManager.set(
        `fail_reason:${recovery.errorId}`,
        result.error || 'Unknown tool error',
        3600 * 1000,
      );

      const interactive = this.whatsappFormatter.buildButtonMessage(
        recovery.text,
        recovery.options,
        language,
      );
      return {
        text: recovery.text,
        interactive,
      };
    }

    if (result.requires_authorization) {
      const interactive = this.whatsappFormatter.buildAuthButtons(
        result.message,
        result.actionId,
        language,
      );
      return {
        text: result.message,
        interactive,
      };
    }

    const formatted = this.whatsappFormatter.formatResult(
      result.action,
      result.data,
      language,
    );
    let response = formatted.text;
    let interactive = formatted.interactive;

    const company =
      companyId && companyId !== 'NONE'
        ? await this.prisma.company
            .findUnique({
              where: { id: companyId },
              include: { _count: { select: { properties: true } } },
            })
            .catch(() => null)
        : null;

    const collectionRate = company
      ? await this.getCollectionRate(company.id)
      : 0;

    const nextStep = this.orchestrator.computeNextStep(result, {
      companyName: company?.name,
      propertyCount: company?._count?.properties,
      collectionRate,
      language: (language as any) || 'en',
    });

    if (nextStep) {
      response += this.orchestrator.formatNextStep(nextStep);

      // If the tool didn't already provide interactive elements, use nextStep's options
      if (!interactive && nextStep.options) {
        interactive = this.whatsappFormatter.buildButtonMessage(
          response,
          nextStep.options,
          language,
        );
      }

      await this.syncSessionOptions(sender.id, nextStep.options, sender.phone);
    }

    return { text: response, interactive };
  }

  async syncSessionOptions(
    userId: string,
    options?: { key: string; label: string; action: string }[],
    phone?: string,
  ) {
    if (!options || options.length === 0) return;
    const uid = getSessionUid({ userId, phone });
    const sessionKey = `ai_session:${uid}`;
    try {
      const session = (await this.cacheManager.get<any>(sessionKey)) || {
        userId: uid,
      };

      const optionsMap = options.reduce((acc: any, o) => {
        acc[o.key] = o.action;
        return acc;
      }, {});

      session.pendingConfirmation = {
        action: 'orchestrated_selection',
        context: {},
        expiresAt: Date.now() + 5 * 60 * 1000,
        options: optionsMap,
      };

      // ALSO persist as the last action menu so it survives the single-use pendingConfirmation
      session.lastActionMenu = {
        role: 'ORCHESTRATED',
        options: optionsMap,
      };

      await this.cacheManager.set(sessionKey, session, 3600 * 1000); // 1 hour
    } catch (e) {
      this.logger.error(`[syncSessionOptions] Failed: ${e.message}`);
    }
  }

  private async executeGeminiToolLoop(
    chatId: string,
    userMessage: string,
    history: any[],
    intent: 'read' | 'write' | 'report',
    context: any,
    language: string,
    classification?: ClassificationResult,
    attachments?: any[],
  ): Promise<{
    response: string;
    chatId: string;
    generatedFiles?: any[];
    vcSummary?: any;
    requires_authorization?: boolean;
    actionId?: string;
  }> {
    // Ensure we use a Gemini-compatible model name for Google SDK
    const geminiModelName =
      this.modelName.includes('/') || this.modelName.includes('-oss-')
        ? this.fallbackModel
        : this.modelName;
    const persona = getPersonaByRole(
      (context.role as string) || UserRole.COMPANY_STAFF,
    );

    const systemPrompt = await this.buildSystemMessage(
      userMessage,
      context,
      language,
      classification,
    );

    let calls = 0;
    let responseText = '';
    let requiresAuthorization = false;
    let lastActionId: string | undefined = undefined;
    const sessionRequestId = randomUUID();
    context.requestId = sessionRequestId;
    const sessionAuditLogIds: string[] = [];

    const generatedFiles: { url: string; fileName: string }[] = [];
    let lastVcSummary: any = undefined;
    this.recentToolCalls.clear();

    const internalHistory: any[] = [];
    const activeHistory = [...history];

    try {
      while (calls < 10) {
        const conversationContext = this.buildConversationContext(
          activeHistory,
          context,
        );
        const prunedDecls = selectTools(
          classification?.intent || 'unknown',
          getPersonaByRole(context.role),
          allToolDeclarations,
          conversationContext,
        );

        const model = this.genAI.getGenerativeModel({
          model: this.modelName || BASE_MODEL,
          tools: buildTools(prunedDecls) as any,
          systemInstruction: systemPrompt,
        });

        const currentTurnPrompt =
          calls === 0
            ? userMessage
            : 'The user needs the final result now. DO NOT ask for permission or provide a partial update. Use the tool results above to finalize your analysis and execute any remaining tools (like generate_report_file) to complete the request in this turn.';

        const chat = model.startChat({ history: activeHistory });

        const promptParts: any[] = [{ text: currentTurnPrompt }];
        if (calls === 0 && attachments && attachments.length > 0) {
          const hasImages = attachments.some(a => a.mimeType?.startsWith('image/'));
          if (hasImages) {
             promptParts[0].text = `[NOTICE: VISION ENABLED] One or more images are attached to this message. Use your NATIVE VISION to read their contents directly. DO NOT call any scripts for OCR.\n\n` + promptParts[0].text;
          }
          for (const attachment of attachments) {
            if (attachment.mimeType?.startsWith('image/') && attachment.data) {
              promptParts.push({
                inlineData: {
                  data: attachment.data,
                  mimeType: attachment.mimeType,
                },
              });
            }
          }
          this.logger.debug(
            `[GeminiLoop] Including ${promptParts.length - 1} image(s) in the first turn.`,
          );
        }

        const result = await withRetry(() => chat.sendMessage(promptParts));

        // IMPORTANT: update activeHistory with what was just sent and received
        // Gemini's ChatSession maintains its own history, but we need to track it manually
        // for the NEXT turn of our loop while calls < 10.
        activeHistory.push({
          role: 'user',
          parts: promptParts,
        });

        const response = result.response;
        const candidate = response.candidates?.[0];
        const parts = candidate?.content?.parts || [];

        activeHistory.push({
          role: 'model',
          parts: parts,
        });

        const functionCalls = parts.filter((p) => p.functionCall);

        const textPart = parts.find((p) => p.text);
        if (textPart && textPart.text) {
          this.logger.debug(
            `[GeminiLoop] Received text: ${textPart.text.substring(0, 50)}...`,
          );
          // Only accumulate text if there are NO tool calls in this turn (it's the answer)
          if (functionCalls.length === 0) {
            responseText += (responseText ? '\n\n' : '') + textPart.text;
          } else {
            this.logger.debug(
              `[GeminiLoop] Filtering out reasoning text part: ${textPart.text.substring(0, 50)}...`,
            );
          }
        }

        if (functionCalls.length === 0) {
          this.logger.debug(`[GeminiLoop] No tool calls, breaking.`);
          break;
        }

        calls++;
        this.logger.log(
          `[GeminiLoop] Executing ${functionCalls.length} tool calls...`,
        );
        const toolResultsParts: any[] = [];

        for (const part of functionCalls) {
          const { name, args } = part.functionCall!;
          this.logger.debug(`[GeminiLoop] Executing: ${name}`);
          const actionResult = await this.executeTool(
            name,
            args,
            context,
            language,
          );
          const toolResult = actionResult.success
            ? actionResult.data
            : actionResult.error;

          if (actionResult.requires_authorization) {
            requiresAuthorization = true;
            lastActionId = actionResult.actionId;
            break; // Stop loop and return to orchestrator
          }

          // --- CHECKPOINT NOTIFICATION ---
          if (
            context.phone &&
            (name === 'run_python_script' ||
              name === 'bulk_create_tenants' ||
              name === 'generate_report_file')
          ) {
            const milestoneMsg = this.getMilestoneMessage(name, language);
            if (milestoneMsg) {
              await this.whatsappService
                .sendTextMessage({
                  to: context.phone,
                  text: `🔄 ${milestoneMsg}`,
                })
                .catch(() => {}); // Best effort
            }
          }

          const fileUrl = toolResult?.url || toolResult?.data?.url;
          if (fileUrl) {
            generatedFiles.push({
              url: fileUrl,
              fileName: fileUrl.split('/').pop() || 'report.dat',
            });
          }

          // Capture version-control summary if present
          if (toolResult?._vc) {
            lastVcSummary = toolResult._vc;
            if (typeof toolResult._vc === 'object' && toolResult._vc.versionId) {
              sessionAuditLogIds.push(toolResult._vc.versionId);
            } else if (typeof toolResult._vc === 'string') {
              sessionAuditLogIds.push(toolResult._vc);
            }
          }

          // Gemini requirement: response MUST be a JSON object (Struct)
          let responseContent = toolResult;
          if (
            typeof toolResult !== 'object' ||
            toolResult === null ||
            Array.isArray(toolResult)
          ) {
            responseContent = { result: toolResult };
          }

          toolResultsParts.push({
            functionResponse: {
              name,
              response: responseContent,
            },
          });
        }

        // Add tool results to history
        activeHistory.push({
          role: 'function',
          parts: toolResultsParts,
        });
      }

      // --- SUPERVISION LOOP ---
      const structuredMatch = responseText.match(
        /JSON_STRUCTURED_OUTPUT:\s*(\{.*\})/s,
      );
      if (structuredMatch) {
        const rawJson = structuredMatch[1];
        const skillId = this.detectSkill(rawJson);
        if (skillId) {
          this.logger.log(
            `Detected skill ${skillId} in response. Running supervision...`,
          );
          // Create a fresh chat session for correction if needed
          const geminiModel = this.genAI.getGenerativeModel({
            model: geminiModelName,
            systemInstruction: systemPrompt,
          });
          const correctionChat = geminiModel.startChat({
            history: activeHistory,
          });
          const enrichedContext = await this.enrichSupervisionContext(
            skillId,
            userMessage,
            context,
            language,
          );
          const supervisedResponse = await this.runSupervisedLoop(
            skillId,
            rawJson,
            enrichedContext,
            correctionChat,
          );
          responseText = supervisedResponse;
        }
      }

      const banner = this.systemDegradation.getWarningBanner(language);
      if (banner) responseText = banner + responseText;

      // Append Session Diff if any changes were made
      if (sessionAuditLogIds.length > 0) {
        const sessionLogs = await this.prisma.auditLog.findMany({
          where: { id: { in: sessionAuditLogIds } },
          orderBy: { timestamp: 'asc' },
        });
        const diffReport = formatters.formatSessionDiff(sessionLogs);
        if (diffReport) responseText += diffReport;
      }

      await this.prisma.chatMessage.create({
        data: {
          chatHistoryId: chatId,
          role: 'assistant',
          content: responseText,
        },
      });

      return {
        response: responseText,
        chatId,
        generatedFiles: generatedFiles.length > 0 ? generatedFiles : undefined,
        vcSummary: lastVcSummary,
        requires_authorization: requiresAuthorization,
        actionId: lastActionId,
      };
    } catch (error: any) {
      this.logger.error(`Gemini loop failed: ${error.message}`);
      throw error;
    }
  }

  private async executeGroqToolLoop(
    chatId: string,
    userMessage: string,
    history: any[],
    intent: 'read' | 'write' | 'report',
    context: any,
    language: string,
    classification?: ClassificationResult,
    attachments?: any[],
    modelName: string = this.primaryModel,
  ): Promise<{
    response: string;
    chatId: string;
    generatedFiles?: any[];
    vcSummary?: any;
    requires_authorization?: boolean;
    actionId?: string;
  }> {
    const persona = getPersonaByRole(
      (context.role as string) || UserRole.COMPANY_STAFF,
    );
    const systemPrompt = await this.buildSystemMessage(
      userMessage,
      context,
      language,
      classification,
    );

    let calls = 0;
    let responseText = '';
    let requiresAuthorization = false;
    let lastActionId: string | undefined = undefined;
    const sessionRequestId = randomUUID();
    context.requestId = sessionRequestId;
    const sessionAuditLogIds: string[] = [];

    const generatedFiles: { url: string; fileName: string }[] = [];
    let lastVcSummary: any = undefined;
    this.recentToolCalls.clear();

    // Build multimodal content ONLY if model name suggests vision support or is Gemini
    const isVisionCapable =
      this.primaryModel.includes('vision') ||
      this.primaryModel.includes('llava') ||
      this.primaryModel.includes('pixtral') ||
      this.primaryModel.includes('flash') ||
      this.primaryModel.includes('pro');

    let userContent: any = userMessage;
    if (attachments && attachments.length > 0 && isVisionCapable) {
      userContent = [{ type: 'text', text: userMessage }];
      for (const attachment of attachments) {
        if (attachment.mimeType?.startsWith('image/')) {
          userContent.push({
            type: 'image_url',
            image_url: {
              url: `data:${attachment.mimeType};base64,${attachment.data}`,
            },
          });
        }
      }
    }

    const activeMessages: any[] = [
      { role: 'system' as any, content: systemPrompt },
      ...this.normalizeHistoryForOpenAI(history),
      { role: 'user' as any, content: userContent },
    ];

    const internalHistory: any[] = [...history];

    try {
      while (calls < 10) {
        const conversationContext = this.buildConversationContext(
          internalHistory,
          context,
        ); // Use internal history for context extraction
        const prunedDecls = selectTools(
          classification?.intent || 'unknown',
          persona,
          allToolDeclarations,
          conversationContext,
        );

        const tools: any[] = prunedDecls.map((d) => ({
          type: 'function',
          function: {
            name: d.name,
            description: d.description,
            parameters: d.parameters,
          },
        }));

        const currentTurnContent =
          'The user needs the final result now. Use the tool results above to finalize your analysis and execute any remaining tools to complete the request.';
        const toolNames = prunedDecls.map((d) => d.name).join(', ');
        activeMessages[0].content = `${systemPrompt}\n\n[AVAILABLE_TOOLS_FOR_THIS_TURN]\n${toolNames}`;

        const completion = await withRetry(() =>
          this.groq.chat.completions.create({
            model: modelName,
            messages: activeMessages,
            tools: tools.length > 0 ? tools : undefined,
            tool_choice: tools.length > 0 ? 'auto' : undefined,
            temperature: 0.1,
          }),
        );

        const message = completion.choices[0]?.message;
        if (!message) break;

        const sanitizedMessage = { ...message, content: message.content || '' };
        activeMessages.push(sanitizedMessage);
        internalHistory.push({
          role: 'model',
          parts: [
            { text: sanitizedMessage.content },
            ...(message.tool_calls || []).map((tc) => ({
              functionCall: {
                name: tc.function.name,
                args: JSON.parse(tc.function.arguments),
              },
            })),
          ],
        } as any);

        if (sanitizedMessage.content) {
          // Only accumulate text if there are NO tool calls in this turn
          if (!message.tool_calls || message.tool_calls.length === 0) {
            responseText +=
              (responseText ? '\n\n' : '') + sanitizedMessage.content;
          } else {
            this.logger.debug(
              `[GroqLoop] Filtering out reasoning text part: ${sanitizedMessage.content.substring(0, 50)}...`,
            );
          }
        }

        if (!message.tool_calls || message.tool_calls.length === 0) {
          break;
        }

        calls++;
        this.logger.log(
          `[GroqLoop] Executing ${message.tool_calls.length} tool calls...`,
        );

        for (const toolCall of message.tool_calls) {
          const { name, arguments: argsJson } = toolCall.function;
          const args = JSON.parse(argsJson);

          const actionResult = await this.executeTool(
            name,
            args,
            context,
            language,
          );
          const toolResult = actionResult.success
            ? actionResult.data
            : actionResult.error;

          if (actionResult.requires_authorization) {
            requiresAuthorization = true;
            lastActionId = actionResult.actionId;
            break; // Stop loop and return to orchestrator
          }

          const fileUrl = toolResult?.url || toolResult?.data?.url;
          if (fileUrl) {
            generatedFiles.push({
              url: fileUrl,
              fileName: fileUrl.split('/').pop() || 'report.dat',
            });
          }
          // Capture version-control summary if present
          if (toolResult?._vc) {
            lastVcSummary = toolResult._vc;
            if (typeof toolResult._vc === 'object' && toolResult._vc.versionId) {
              sessionAuditLogIds.push(toolResult._vc.versionId);
            } else if (typeof toolResult._vc === 'string') {
              sessionAuditLogIds.push(toolResult._vc);
            }
          }

          const GROQ_TOOL_RESULT_CHAR_BUDGET = 4000;
          const trimmedForGroq = this.trimToolResultForGroq(
            toolResult,
            GROQ_TOOL_RESULT_CHAR_BUDGET,
          );

          activeMessages.push({
            role: 'tool' as any,
            tool_call_id: toolCall.id,
            content: trimmedForGroq,
          });

          internalHistory.push({
            role: 'function',
            parts: [{ functionResponse: { name, response: toolResult } }],
          } as any);
        }
      }

      // --- SUPERVISION LOOP ---
      const structuredMatch = responseText.match(
        /JSON_STRUCTURED_OUTPUT:\s*(\{.*\})/s,
      );
      if (structuredMatch) {
        const rawJson = structuredMatch[1];
        const skillId = this.detectSkill(rawJson);
        if (skillId) {
          this.logger.log(
            `Detected skill ${skillId} in response. Running supervision...`,
          );
          // For Groq, we handle correction via Gemini (multi-modal/reliable) if chat is null
          const enrichedContext = await this.enrichSupervisionContext(
            skillId,
            userMessage,
            context,
            language,
          );
          const supervisedResponse = await this.runSupervisedLoop(
            skillId,
            rawJson,
            enrichedContext,
            null,
          );
          responseText = supervisedResponse;
        }
      }

      const banner = this.systemDegradation.getWarningBanner(language);
      if (banner) responseText = banner + responseText;

      // Append Session Diff if any changes were made
      if (sessionAuditLogIds.length > 0) {
        const sessionLogs = await this.prisma.auditLog.findMany({
          where: { id: { in: sessionAuditLogIds } },
          orderBy: { timestamp: 'asc' },
        });
        const diffReport = formatters.formatSessionDiff(sessionLogs);
        if (diffReport) responseText += diffReport;
      }

      const { text: cleanText } =
        this.whatsappFormatter.convertTablesToLists(responseText);
      responseText = cleanText;

      await this.prisma.chatMessage.create({
        data: {
          chatHistoryId: chatId,
          role: 'assistant',
          content: responseText,
        },
      });

      return {
        response: responseText,
        chatId,
        generatedFiles: generatedFiles.length > 0 ? generatedFiles : undefined,
        vcSummary: lastVcSummary,
        requires_authorization: requiresAuthorization,
        actionId: lastActionId,
      };
    } catch (error: any) {
      this.logger.error(`Groq loop failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Trim a tool result to a safe character budget for Groq's low-TPM models.
   * - Arrays: keep up to maxItems entries + a truncation notice
   * - Objects/primitives: JSON-stringify and hard-cap at budget
   * Gemini loop is NOT affected — it receives the full result via internalHistory.
   */
  private trimToolResultForGroq(result: any, charBudget: number): string {
    if (result === null || result === undefined) return 'null';

    if (Array.isArray(result)) {
      const maxItems = 10;
      const trimmed = result.slice(0, maxItems);
      const remaining = result.length - trimmed.length;
      const payload: any = { items: trimmed };
      if (remaining > 0) {
        payload._truncated = `${remaining} more items omitted to fit context window. Ask for a filtered query for more.`;
      }
      const str = JSON.stringify(payload);
      if (str.length <= charBudget) return str;
      // Still too big — try fewer items
      for (let n = maxItems - 1; n >= 1; n--) {
        const s = JSON.stringify({ items: result.slice(0, n), _truncated: `Showing ${n}/${result.length}` });
        if (s.length <= charBudget) return s;
      }
    }

    const full = JSON.stringify(result);
    if (full.length <= charBudget) return full;
    return full.substring(0, charBudget - 50) + '..." [truncated — full result available in context]';
  }

  private buildConversationContext(
    history: any[],
    effectiveContext: any,
  ): ConversationContext {
    const context: ConversationContext = {
      role: effectiveContext.role,
      userId: effectiveContext.userId,
      companyId: effectiveContext.companyId,
    };

    for (let i = history.length - 1; i >= 0; i--) {
      const parts = history[i].parts;
      if (!parts) continue;

      const toolCallPart = parts.find((p: any) => p.functionCall);
      const toolRespPart = parts.find((p: any) => p.functionResponse);

      if (toolCallPart) {
        const toolName = toolCallPart.functionCall?.name;
        if (toolName) {
          if (!context.lastToolName) context.lastToolName = toolName;
          const entityType = TOOL_ENTITY_MAP[toolName];
          if (entityType && !context.lastEntityType) {
            context.lastEntityType = entityType;
          }
        }
      }

      if (toolRespPart) {
        const resp = toolRespPart.functionResponse?.response;
        this.logger.log(
          `[GeminiLoop] Tool ${toolRespPart.functionResponse?.name} returned result. Length: ${JSON.stringify(resp).length}`,
        );
        if (resp && typeof resp === 'object') {
          // Try to extract IDs from tool results to populate context
          if (resp.id && !context.lastEntityId) {
            context.lastEntityId = resp.id;
          }
          if (resp.companyId && !context.companyId) {
            context.companyId = resp.companyId;
          }
          if (resp.propertyId && !context.propertyId) {
            context.propertyId = resp.propertyId;
          }
        }
      }

      if (context.lastEntityType && context.lastEntityId) break;
    }

    return context;
  }

  private async buildSystemMessage(
    message: string,
    context: any,
    language: string,
    classification?: ClassificationResult,
  ): Promise<string> {
    const persona = getPersonaByRole(context.role || UserRole.UNIDENTIFIED);
    const skill = classification
      ? getSkillByIntent(classification.intent)
      : undefined;
    const isSw = language === 'sw';
    const now = new Date();

    return `[SYSTEM CONTEXT]
- IDENTITY: ${persona.name}
- CONSTITUTION: ${skill?.persona_id ? MASTER_PERSONAS[skill.persona_id].constitution : persona.constitution}
- BEHAVIOURAL RULES: ${persona.behavioral_rules.join(' | ')}
- TARGET LANGUAGE: ${isSw ? 'Swahili' : 'English'}
- CURRENT_TIME: ${now.toISOString()}
- SKILL INSTRUCTIONS: ${skill ? (isSw ? skill.language_variants.sw : skill.language_variants.en) : 'None'}
- SKILL LOGIC: ${skill?.system_prompt_injection || 'None'}

[LOCAL FILES]
${
  context.savedAttachments?.length > 0
    ? `The following files were just uploaded and saved to the server's local disk:\n${context.savedAttachments.map((p: string) => `- ${p}`).join('\n')}\n` +
      `- GUIDANCE: Use 'run_python_script' FOR DATA FILES (Excel, CSV, PDF text).\n` +
      `- CRITICAL: DO NOT use 'run_python_script' for IMAGES. Use your NATIVE VISION capabilities instead.`
    : 'No new files uploaded in this turn.'
}

[CAPABILITIES]
- ACCESS: You have full read/write access to the Aedra Property Management System via the provided tools.
- TOOL USAGE: If the user asks for data or actions, YOU MUST USE THE CORRESPONDING TOOL.
- AGENTIC POWER: You are an autonomous agent. You can perform complex multi-step tasks by calling tools sequentially.

[REPORTING_RULES]
- AUTOMATIC SUMMARY: A "📊 System Change Summary" is automatically appended to your response by the system after any tool execution that modifies data.
- NO MANUAL HISTORY CALLS: Do NOT call 'view_version_history' or other history tools just to show the user what changed; the auto-summary handles this in a cleaner format.
- TONE: Professional and precise. Use emojis like ✅, ✏️, and 🆕.

User Message: ${message}`;
  }

  private async enrichSupervisionContext(
    skillId: string,
    userMessage: string,
    context: any,
    language: string,
  ): Promise<string> {
    let enrichedContext = `Context: ${userMessage}`;

    if (skillId === 'add_tenant') {
      try {
        const duplicates = await this.registry.executeTool(
          'detect_duplicates',
          {},
          context,
          context.role,
          language,
        );
        if (duplicates && duplicates.groups && duplicates.groups.length > 0) {
          enrichedContext += `\n\n[CRITICAL: POTENTIAL DUPLICATES DETECTED IN DATABASE]\n${JSON.stringify(duplicates.groups, null, 2)}`;
          enrichedContext += `\n\nNote: If any of these matches the user's request, the agent MUST NOT create a new record. Instead, it should alert the user and offer to use the existing one or merge.`;
        }
      } catch (e) {
        this.logger.error(
          `Failed to enrich supervision context for ${skillId}: ${e.message}`,
        );
      }
    }

    return enrichedContext;
  }

  private detectSkill(json: string): string | null {
    try {
      const data = JSON.parse(json);
      const keys = Object.keys(data);

      for (const skill of SKILLS_REGISTRY) {
        const schemaKeys = Object.keys(skill.outputSchema.properties || {});
        const overlap = keys.filter((k) => schemaKeys.includes(k));
        if (overlap.length >= 1) {
          return skill.skill_id;
        }
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  private resolveConsistency(samples: string[]): string {
    const counts = new Map<string, number>();
    let maxCount = 0;
    let winner = samples[0];

    for (const s of samples) {
      try {
        const obj = JSON.parse(s);
        const canonical = JSON.stringify(obj, Object.keys(obj).sort());
        const count = (counts.get(canonical) || 0) + 1;
        counts.set(canonical, count);
        if (count > maxCount) {
          maxCount = count;
          winner = s;
        }
      } catch (e) {
        continue;
      }
    }
    return winner;
  }

  private async runSupervisedLoop(
    skillId: string,
    rawJson: string,
    contextString: string,
    chat: any,
  ): Promise<string> {
    let currentJson = rawJson;
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      const verdict = await this.critic.evaluate(
        skillId,
        currentJson,
        contextString,
      );
      if (verdict.pass) {
        const pipelineResult = await this.responsePipeline.processResponse(
          skillId,
          currentJson,
        );
        if (pipelineResult.success) {
          return pipelineResult.output || '';
        } else {
          this.logger.warn(
            `Pipeline failed for ${skillId} after critic pass: ${pipelineResult.errors?.join(', ')}`,
          );
          return `[System Note: Output failed validation: ${pipelineResult.errors?.join(', ')}]`;
        }
      }

      attempts++;
      this.logger.warn(
        `Critic failed for ${skillId}. Attempting correction ${attempts}/${maxAttempts}. Feedback: ${verdict.feedback.join(' | ')}`,
      );

      const correctionPrompt = `
Your previous output failed the quality criteria. Please fix the following issues:
${verdict.feedback.map((f) => `- ${f}`).join('\n')}

REQUIRED OUTPUT FORMAT:
JSON_STRUCTURED_OUTPUT: { ... your corrected JSON here ... }
`;
      try {
        if (!chat) {
          this.logger.warn(
            `No chat object provided for supervised loop correction. Using fallback.`,
          );
          break;
        }
        const result = await withRetry(() =>
          chat.sendMessage(correctionPrompt),
        );
        const response = await (result as any).response;
        const text = response.text().trim();
        const match = text.match(/JSON_STRUCTURED_OUTPUT:\s*(\{.*\})/s);
        if (match) {
          currentJson = match[1];
        } else {
          this.logger.error(
            `Model failed to provide JSON_STRUCTURED_OUTPUT in correction attempt ${attempts}`,
          );
          break;
        }
      } catch (e) {
        this.logger.error(`Correction message failed: ${e.message}`);
        break;
      }
    }

    const lastPipelineResult = await this.responsePipeline.processResponse(
      skillId,
      currentJson,
    );
    return (
      lastPipelineResult.output ||
      `[System Note: Structured output for ${skillId} failed quality checks.]`
    );
  }

  private async saveAttachments(
    attachments: any[],
    chatId: string,
  ): Promise<string[]> {
    if (!attachments || attachments.length === 0) return [];
    const savedPaths: string[] = [];
    const uploadsDir = join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir))
      fs.mkdirSync(uploadsDir, { recursive: true });

    for (const [index, attachment] of attachments.entries()) {
      if (attachment.data && attachment.mimeType) {
        const ext = this.getExt(attachment.mimeType);
        const fileName = `wa_upload_${chatId}_${Date.now()}_${index}.${ext}`;
        const filePath = join(uploadsDir, fileName);
        try {
          await writeFile(filePath, Buffer.from(attachment.data, 'base64'));
          savedPaths.push(filePath);
          this.logger.log(`Saved attachment to: ${filePath}`);
        } catch (e) {
          this.logger.error(`Failed to save attachment ${index}: ${e.message}`);
        }
      }
    }
    return savedPaths;
  }

  private getExt(mime: string): string {
    const m = mime.toLowerCase();
    if (
      m.includes('spreadsheet') ||
      m.includes('excel') ||
      m.includes('officedocument.spreadsheetml')
    )
      return 'xlsx';
    if (m.includes('csv')) return 'csv';
    if (m.includes('pdf')) return 'pdf';
    if (m.includes('image/jpeg')) return 'jpg';
    if (m.includes('image/png')) return 'png';
    if (m.includes('text/plain')) return 'txt';
    return 'dat';
  }

  async summarizeForWhatsApp(
    text: string,
    language: string = 'en',
  ): Promise<string> {
    try {
      // Ensure we use a Gemini-eligible model for summarization
      const summarizerModel =
        this.modelName.includes('/') || this.modelName.includes('-oss-')
          ? this.fallbackModel
          : this.modelName;
      const model = this.genAI.getGenerativeModel({ model: summarizerModel });
      const prompt =
        language === 'sw'
          ? `Fupisha ujumbe huu wa WhatsApp kwa kifupi (chini ya maneno 50): ${text}`
          : `Summarize this WhatsApp message briefly (under 50 words): ${text}`;
      const result = await withRetry(() => model.generateContent(prompt));
      return result.response.text().trim();
    } catch (e) {
      this.logger.warn(`[Summarize] Failed: ${e.message}`);
      return text;
    }
  }

  // --- Controller-friendly helpers (lightweight stubs where full flows aren't available) ---
  async getChatSessions(userId: string) {
    return this.prisma.chatHistory.findMany({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getChatHistory(chatId: string) {
    return this.prisma.chatMessage.findMany({
      where: { chatHistoryId: chatId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listActiveWorkflows(userId: string) {
    const active = await this.workflowEngine.getActiveInstance(userId);
    return active ? [active] : [];
  }

  async submitFeedback(messageId: string, score: number, note?: string) {
    this.logger.log(
      `Feedback received for message ${messageId}: ${score} - ${note}`,
    );

    try {
      await this.prisma.chatMessage.update({
        where: { id: messageId },
        data: {
          feedbackScore: score,
          feedbackNote: note,
        },
      });
      return { success: true, message: 'Thank you for your feedback!' };
    } catch (error) {
      this.logger.error(`Failed to save feedback: ${error.message}`);
      return {
        success: false,
        message: 'Could not save feedback at this time.',
      };
    }
  }

  async executeApprovedAction(actionId: string, approverId: string) {
    return { status: 'approved', actionId, approverId };
  }

  // WhatsApp orchestration passthrough for legacy callers/tests
  async handleIncomingWhatsapp(
    phone: string,
    text?: string,
    mediaId?: string,
    mimeType?: string,
  ) {
    return this.whatsappOrchestrator.handleIncomingWhatsapp(
      phone,
      text,
      mediaId,
      mimeType,
    );
  }

  private async handlePlanningFlow(
    chatId: string,
    message: string,
    history: any[],
    context: any,
    language: string,
    classification?: ClassificationResult,
    attachments?: any[],
  ): Promise<{ response: string; chatId: string; interactive?: any }> {
    const fileInfo =
      attachments && attachments.length > 0
        ? `\nFILES ATTACHED: ${attachments.length} files. Saved paths: ${context.savedAttachments?.join(', ') || 'N/A'}`
        : '';

    const planningPrompt = `
            You are a senior task planner for Aedra Property Management.
            The user has provided a complex, multi-step request: "${message}" ${fileInfo}
            
            YOUR JOB: Break this down into 3-7 clear, actionable steps. If files are attached, specifically include data perusal (e.g., using run_python_script) as the first steps.
            Language: ${language === 'sw' ? 'Swahili' : 'English'}
            
            Format your response as a professional numbered list.
            If in Swahili, ensure the plan is in Swahili.
            Start with: "I've broken this down into a step-by-step plan:" (or Swahili equivalent)
        `;

    const plannerModel =
      this.modelName.includes('/') || this.modelName.includes('-oss-')
        ? this.fallbackModel
        : this.modelName;
    const model = this.genAI.getGenerativeModel({ model: plannerModel });
    const result = await withRetry(() => model.generateContent(planningPrompt));
    const plan = result.response.text();

    // Persist the plan as an assistant message
    await this.prisma.chatMessage.create({
      data: {
        chatHistoryId: chatId,
        role: 'assistant',
        content: plan,
      },
    });

    // Add a confirmation menu
    const menuMessage =
      language === 'sw'
        ? '\n\nUngependa niendelee na mpango huu?'
        : '\n\nWould you like me to proceed with this plan?';

    const options =
      language === 'sw'
        ? [
            { key: '1', label: 'Ndiyo, Endelea', action: 'execute_plan' },
            { key: '2', label: 'Hapana, Ghairi', action: 'cancel_plan' },
          ]
        : [
            { key: '1', label: 'Yes, Proceed', action: 'execute_plan' },
            { key: '2', label: 'No, Cancel', action: 'cancel_plan' },
          ];

    const interactive = {
      type: 'button',
      body: { text: (plan.slice(-100) + menuMessage).trim().slice(0, 1024) }, // Body must be < 1024
      action: {
        buttons: options.slice(0, 3).map((o) => ({
          type: 'reply',
          reply: { id: o.action, title: o.label.slice(0, 20) }, // Title must be < 20
        })),
      },
    };

    // Store the original request in the session so we can execute it upon confirmation
    await this.syncSessionOptions(context.userId, options, context.phone);

    const uid = getSessionUid(context);
    const sessionKey = `ai_session:${uid}`;
    const session = (await this.cacheManager.get<any>(sessionKey)) || {
      userId: uid,
    };
    session.pendingComplexTask = {
      message,
      classification,
      context,
      attachments,
    };
    await this.cacheManager.set(sessionKey, session, 3600 * 1000);

    return { response: plan, chatId, interactive };
  }

  async executePlan(
    userId: string,
    phone: string,
  ): Promise<{ response: string; chatId: string; interactive?: any }> {
    const uid = getSessionUid({ userId, phone });
    const sessionKey = `ai_session:${uid}`;
    const session = await this.cacheManager.get<any>(sessionKey);

    if (!session || !session.pendingComplexTask) {
      return { response: 'No pending plan found.', chatId: '' };
    }

    const { message, classification, context, attachments } =
      session.pendingComplexTask;
    delete session.pendingComplexTask;
    await this.cacheManager.set(sessionKey, session, 3600 * 1000);

    // Execute the original request now
    this.logger.log(`Executing approved plan for ${uid}`);

    const history = await this.getChatHistory(context.chatId);
    const normalizedHistory = this.normalizeHistory(history.slice(-15));

    const classificationResult = classification || {
      intent: 'update_property', // Default to update instead of write if missing during plan
      complexity: 2,
      executionMode: 'INTELLIGENCE',
      language: 'en',
      reason: 'Recovered from session',
    };
    const intent = classificationResult.intent || 'update_property';

    let effectiveAttachments = attachments || [];
    if (effectiveAttachments.length === 0) {
      effectiveAttachments = await this.recoverRecentAttachments(
        context.chatId,
      );
      this.logger.log(
        `[AiService] Recovered ${effectiveAttachments.length} recent attachments for planned execution in chat ${context.chatId}`,
      );
    }

    return await this.executeGeminiToolLoop(
      context.chatId,
      message,
      normalizedHistory,
      intent,
      context,
      classificationResult.language || 'en',
      classificationResult,
      effectiveAttachments,
    );
  }

  private async recoverRecentAttachments(chatId: string): Promise<any[]> {
    const uploadsDir = join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) return [];

    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    try {
      const files = fs.readdirSync(uploadsDir);
      const chatFiles = files.filter((f) =>
        f.startsWith(`wa_upload_${chatId}_`),
      );

      const recovered: any[] = [];
      for (const file of chatFiles) {
        const filePath = join(uploadsDir, file);
        const stats = fs.statSync(filePath);
        if (stats.mtimeMs > tenMinutesAgo) {
          const data = await fs.promises.readFile(filePath);
          const ext = file.split('.').pop();
          const mimeType =
            ext === 'jpg'
              ? 'image/jpeg'
              : ext === 'png'
                ? 'image/png'
                : 'application/octet-stream';

          if (mimeType.startsWith('image/')) {
            recovered.push({
              data: data.toString('base64'),
              mimeType,
            });
          }
        }
      }
      return recovered;
    } catch (e) {
      this.logger.error(`[recoverRecentAttachments] Failed: ${e.message}`);
      return [];
    }
  }

  private getMilestoneMessage(name: string, language: string): string | null {
    const isSwm = language === 'sw';
    switch (name) {
      case 'run_python_script':
        return isSwm
          ? 'Nikuchakata faili na kusoma data...'
          : 'Processing file and reading data...';
      case 'bulk_create_tenants':
        return isSwm
          ? 'Nikiingiza rekodi za wapangaji kwenye mfumo...'
          : 'Ingesting tenant records into the system...';
      case 'generate_report_file':
        return isSwm
          ? 'Nikitengeneza ripoti yako kamili sasa...'
          : 'Generating your full report now...';
      default:
        return null;
    }
  }
}
