import { Injectable, Logger, Inject, BadRequestException, forwardRef, OnModuleInit } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq, { toFile } from 'groq-sdk';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowEngine } from '../workflows/workflow.engine';
import { WorkflowBridgeService } from './workflow-bridge.service';
import { QuorumBridgeService } from './quorum-bridge.service';
import { routeWorkflowRequest } from '../workflows/workflow.router';
import { tenantContext } from '../common/tenant-context';
import { UserRole } from '../auth/roles.enum';
import { buildModels, allToolDeclarations } from './ai.tools';
import { selectModelKey } from './ai.router';
import { EmbeddingsService } from './embeddings.service';
import { withRetry } from '../common/utils/retry';
import { WhatsappService } from '../messaging/whatsapp.service';
import { ResponsePipelineService } from './response-pipeline.service';
import { CriticService } from './critic.service';
import { AiClassifierService, ClassificationResult } from './ai-classifier.service';
import { UnitsService } from '../units/units.service';
import { TemporalContextService } from './temporal-context.service';
import { QueryEnrichmentService } from './query-enrichment.service';
import { AuditLogService } from '../audit/audit-log.service';
import { getPersonaByRole, MASTER_PERSONAS } from './persona.registry';
import { SystemDegradationService } from './system-degradation.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AI_BACKGROUND_QUEUE } from './ai.queue.processor';
import { AiQuotaService } from './ai-quota.service';
import { selectTools, ConversationContext, TOOL_ENTITY_MAP, getSessionUid } from './ai-tool-selector.util';
import { ErrorRecoveryService } from './error-recovery.service';
import { NextStepOrchestrator, ActionResult } from './next-step-orchestrator.service';
import { AiToolRegistryService } from './ai-tool-registry.service';
import { getSkillByIntent } from './skills.registry';
import { AiWhatsappOrchestratorService } from './ai-whatsapp-orchestrator.service';
import { WhatsAppFormatterService } from './whatsapp-formatter.service';

@Injectable()
export class AiService implements OnModuleInit {
    private readonly logger = new Logger(AiService.name);
    private genAI: GoogleGenerativeAI;
    private groq: Groq;
    private models: Record<'read' | 'write' | 'report' | 'gemma', any>;
    private readonly fallbackModel = (process.env.GEMINI_MODEL || '').trim() || 'gemini-2.5-flash';
    private modelName = this.fallbackModel;
    private modelsReady: Promise<void>;
    private isInitializing = false;
    private modelsVerified = false;

    private recentToolCalls = new Map<string, { timestamp: number; result: any }>();

    private openerPool: string[] = ['Habari! Nipo hapa kukusaidia...', 'Hello! How can I assist you today?'];
    private closerPool: string[] = ['Je, kuna lingine?', 'Anything else I can help with?'];
    private toolTemperature = 0.0;
    private chatTemperature = 0.7;
    private toolPresencePenalty = 0.0;
    private chatPresencePenalty = 0.0;
    private historyLimit = 50;
    private systemInstruction = `You are "Aedra", the virtual co-worker for property management professionals.
    
    1. PROACTIVE PLANNING: For complex multi-step tasks, FIRST call generate_execution_plan. Present this plan to the user clearly.
    2. SEQUENTIAL EXECUTION: Proceed logically. If you have data for the next step, EXECUTE it immediately.
    3. WHATSAPP MEDIUM: Format lists with bullet points. NEVER output raw JSON.
    4. SWAHILI SUPPORT: Respond in Swahili only if the user's message is in Swahili.
    5. IDENTITY: You are "Aedra", a strategic property management intelligence system.
    6. ALWAYS use available tools to fulfill requests. If you cannot fulfill a request with the available tools, state that clearly and suggest a manual alternative.`;

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
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy-key');
        this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'dummy-key' });
        
        this.openerPool = this.parsePool(process.env.AI_OPENER_POOL) || this.openerPool;
        this.closerPool = this.parsePool(process.env.AI_CLOSER_POOL) || this.closerPool;
        this.toolTemperature = this.parseNum(process.env.AI_TOOL_TEMP, this.toolTemperature);
        this.chatTemperature = this.parseNum(process.env.AI_CHAT_TEMP, this.chatTemperature);
        this.toolPresencePenalty = this.parseNum(process.env.AI_TOOL_PRESENCE, this.toolPresencePenalty);
        this.chatPresencePenalty = this.parseNum(process.env.AI_CHAT_PRESENCE, this.chatPresencePenalty);
        this.historyLimit = this.parseNum(process.env.AI_HISTORY_LIMIT, 50);

        this.modelsReady = this.initModels();
    }

    getSystemInstruction(): string {
        return this.systemInstruction;
    }

    private parsePool(val?: string): string[] | undefined {
        if (!val) return undefined;
        return val.split(',').map(s => s.trim()).filter(Boolean);
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
            this.models = await buildModels(this.genAI, this.getSystemInstruction(), this.modelName);
            this.logger.log('AI models initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize AI models', error.stack);
        } finally {
            this.isInitializing = false;
        }
    }

    async onModuleInit() {
        this.workflowEngine.setHandlers(this.workflowBridge);
        await this.modelsReady;
        this.verifyHealth();
    }

    private async verifyHealth() {
        if (this.modelsVerified) return;
        try {
            const model = this.genAI.getGenerativeModel({ model: this.modelName });
            await withRetry(() => model.generateContent("health check"), { maxRetries: 1 });
            this.modelsVerified = true;
            this.logger.log(`[HealthCheck] AI Model ${this.modelName} verified successfully.`);
        } catch (e) {
            this.logger.error(`[HealthCheck] AI Model ${this.modelName} verification failed: ${e.message}`);
            // Don't keep retrying on every request if it fails once during init
            this.modelsVerified = true; 
        }
    }

    private normalizeHistory(history: any[]): any[] {
        if (!history || !Array.isArray(history)) return [];
        return history.map(h => {
            const role = h.role === 'assistant' ? 'model' : (h.role || 'user');
            if (h.parts) return { role, parts: h.parts };
            
            const content = h.content || h.message || '';
            return {
                role,
                parts: [{ text: content }]
            };
        });
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
        phone?: string
    ): Promise<{ response: string; chatId: string; generatedFiles?: any[]; interactive?: any }> {
        const normalizedHistory = this.normalizeHistory(history);
        await this.modelsReady;
        if (!this.models) {
            // Safety net: ensure models are initialized even if initModels failed earlier
            this.models = await buildModels(this.genAI, this.getSystemInstruction(), this.modelName);
        }
        if (!this.modelsVerified) await this.verifyHealth();

        const store = tenantContext.getStore() as any;
        const role = store?.role || UserRole.COMPANY_STAFF;
        const userId = store?.userId;
        const finalCompanyId = companyId || store?.companyId;
        const finalChatId = chatId || await this.getOrCreateChat(userId, finalCompanyId);
        const lang = language || 'en';

        const context = { role, userId, companyId: finalCompanyId, chatId: finalChatId, jobId, isSuperAdmin: role === UserRole.SUPER_ADMIN, phone };

        const enrichedMessage = await this.enrichment.enrich(message, normalizedHistory, context);
        const finalMessage = enrichedMessage || message;

        // 2. Intent Classification (if not provided by caller)
        let finalClassification = classification;
        if (!finalClassification) {
            const historyStrings = history.slice(-5).map(h => h.content || h.message || '');
            finalClassification = await this.classifier.classify(finalMessage, role, historyStrings);
        }

        const intent = finalClassification.intent || 'read';
        const mode = finalClassification.executionMode || 'LIGHT_COMPOSE';

        this.logger.log(`[AiService] Final Classification: intent=${intent}, mode=${mode}, reason=${finalClassification.reason}`);
        this.logger.log(`[AiService] Incoming chat request: chatId=${finalChatId}, role=${role}, message="${message.slice(0, 100)}..."`);

        // Persist the user message immediately
        await this.prisma.chatMessage.create({
            data: {
                chatHistoryId: finalChatId,
                role: 'user',
                content: message,
            }
        });

        // 3. Workflow Routing
        const workflowResult = await routeWorkflowRequest(this.workflowEngine, {
            userId: context.userId,
            message: finalMessage,
            intent,
            context: { ...context, chatId: finalChatId },
            agentFallback: async () => {
                // Original LLM Tool Loop logic (using same mode check)
                if (mode === 'INTELLIGENCE' || mode === 'ORCHESTRATED' || mode === 'LIGHT_COMPOSE' || mode === 'DIRECT_LOOKUP' || mode === 'PLANNING') {
                    this.logger.log(`[AiService] Entering multi-turn tool loop for mode: ${mode}`);
                    const safeIntent = (['read', 'write', 'report'].includes(intent) ? intent : 'read') as 'read' | 'write' | 'report';
                    return this.executeGeminiToolLoop(finalChatId, finalMessage, normalizedHistory, safeIntent, context, lang, finalClassification);
                }
                return null;
            }
        });

        if (workflowResult && workflowResult.instanceId) {
            const currentStep = workflowResult.currentState;
            const responseText = `[Workflow: ${workflowResult.workflowId}] Current State: ${currentStep}\n\nI have initiated the multi-step process for your request. I will notify you as soon as the next step is ready.`;
            
            await this.prisma.chatMessage.create({
                data: {
                    chatHistoryId: finalChatId,
                    role: 'assistant',
                    content: responseText,
                }
            });

            return {
                response: responseText,
                chatId: finalChatId,
            };
        }

        if (workflowResult) return workflowResult;


        const route = await selectModelKey(this.genAI, finalMessage, normalizedHistory, this.modelName, this.groq);
        const model = this.models[route.intent];
        const chat = model.startChat({ history: normalizedHistory });

        const systemMessage = await this.buildSystemMessage(finalMessage, context, lang, classification);
        const result: any = await withRetry(() => chat.sendMessage(systemMessage));
        const response = result?.response?.text ? result.response.text() : (result?.text ? result.text() : '');

        await this.prisma.chatMessage.create({
            data: {
                chatHistoryId: finalChatId,
                role: 'assistant',
                content: response,
            }
        });

        return { response, chatId: finalChatId };
    }

    private async getOrCreateChat(userId: string, companyId: string): Promise<string> {
        const lastChat = await this.prisma.chatHistory.findFirst({
            where: { userId, companyId, deletedAt: null },
            orderBy: { updatedAt: 'desc' }
        });

        if (lastChat && Date.now() - lastChat.updatedAt.getTime() < 30 * 60 * 1000) {
            return lastChat.id;
        }

        const newChat = await this.prisma.chatHistory.create({
            data: { userId, companyId: companyId as any }
        });
        return newChat.id;
    }

    async executeTool(name: string, args: any, context: any, language: string = 'en'): Promise<ActionResult> {
        const role = context.role || UserRole.COMPANY_STAFF;
        const t0 = Date.now();
        const cacheKey = `tool:${name}:${JSON.stringify(args)}:${context.userId}`;
        
        const recent = this.recentToolCalls.get(cacheKey);
        if (recent && Date.now() - recent.timestamp < 10000) {
            return { success: true, data: recent.result, action: name };
        }

        try {
            const data = await this.registry.executeTool(name, args, context, role, language);
            if (data?.error) return { success: false, data: null, error: data.error, action: name };

            this.recentToolCalls.set(cacheKey, { timestamp: Date.now(), result: data });
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

    private async getCollectionRate(companyId: string): Promise<number> {
        try {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

            const [totalInvoiced, totalPaid] = await Promise.all([
                this.prisma.invoice.aggregate({
                    where: {
                        lease: { property: { companyId, deletedAt: null } },
                        createdAt: { gte: startOfMonth, lte: endOfMonth },
                        deletedAt: null
                    },
                    _sum: { amount: true }
                }),
                this.prisma.payment.aggregate({
                    where: {
                        lease: { property: { companyId, deletedAt: null } },
                        paidAt: { gte: startOfMonth, lte: endOfMonth },
                        deletedAt: null
                    },
                    _sum: { amount: true }
                })
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

    async formatToolResponse(result: any, sender: any, companyId: string, language: string): Promise<{ text: string; interactive?: any }> {
        if (!result.success) {
            return {
                text: this.recovery.buildErrorRecovery(result.action, new Error(result.error), { userId: sender.id }, language as any)
            };
        }
        
        const formatted = this.whatsappFormatter.formatResult(result.action, result.data, language);
        let response = formatted.text;
        let interactive = formatted.interactive;

        const company = (companyId && companyId !== 'NONE')
            ? await this.prisma.company.findUnique({ 
                where: { id: companyId as string },
                include: { _count: { select: { properties: true } } }
            }).catch(() => null)
            : null;

        const collectionRate = company ? await this.getCollectionRate(company.id) : 0;

        const nextStep = this.orchestrator.computeNextStep(result, {
            companyName: company?.name,
            propertyCount: company?._count?.properties,
            collectionRate,
            language: (language as any) || 'en'
        });
        
        if (nextStep) {
            response += this.orchestrator.formatNextStep(nextStep);
            
            // If the tool didn't already provide interactive elements, use nextStep's options
            if (!interactive && nextStep.options) {
                interactive = this.whatsappFormatter.buildButtonMessage(response, nextStep.options);
            }

            await this.syncSessionOptions(sender.id, nextStep.options, sender.phone);
        }

        return { text: response, interactive };
    }

    async syncSessionOptions(userId: string, options?: { key: string; label: string; action: string }[], phone?: string) {
        if (!options || options.length === 0) return;
        const uid = getSessionUid({ userId, phone });
        const sessionKey = `ai_session:${uid}`;
        try {
            const session = await this.cacheManager.get<any>(sessionKey) || { userId: uid };
            
            const optionsMap = options.reduce((acc: any, o) => { acc[o.key] = o.action; return acc; }, {});

            session.pendingConfirmation = {
                action: 'orchestrated_selection',
                context: {}, 
                expiresAt: Date.now() + 5 * 60 * 1000,
                options: optionsMap
            };

            // ALSO persist as the last action menu so it survives the single-use pendingConfirmation
            session.lastActionMenu = {
                role: 'ORCHESTRATED',
                options: optionsMap
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
        classification?: ClassificationResult
    ): Promise<{ response: string; chatId: string; generatedFiles?: any[] }> {
        const geminiModelName = this.modelName; // Usually gemini-2.5-flash
        const persona = getPersonaByRole((context.role as string) || UserRole.COMPANY_STAFF);
        
        const systemPrompt = await this.buildSystemMessage(userMessage, context, language, classification);

        let calls = 0;
        let responseText = '';
        const generatedFiles: { url: string; fileName: string }[] = [];
        this.recentToolCalls.clear();

        const internalHistory: any[] = [];
        const activeHistory = [...history];

        try {
            while (calls < 10) {
                const conversationContext = this.buildConversationContext(activeHistory, context);
                
                const prunedDecls = selectTools(
                    classification?.intent || 'unknown',
                    persona,
                    allToolDeclarations,
                    conversationContext
                );

                this.logger.debug(`[GeminiLoop] Turn ${calls}: ${prunedDecls.length} tools available. (Intent: ${classification?.intent})`);

                const model = this.genAI.getGenerativeModel({
                    model: geminiModelName,
                    tools: prunedDecls.length > 0 ? [{ functionDeclarations: prunedDecls }] as any : undefined,
                    systemInstruction: systemPrompt,
                });

                const currentTurnPrompt = (calls === 0) 
                    ? userMessage 
                    : "The user needs the final result now. DO NOT ask for permission or provide a partial update. Use the tool results above to finalize your analysis and execute any remaining tools (like generate_report_file) to complete the request in this turn.";
                
                // Add the user turn to active history BEFORE sending
                activeHistory.push({
                    role: 'user',
                    parts: [{ text: currentTurnPrompt }]
                });


                const chat = model.startChat({ history: activeHistory });
                const result = await withRetry(() => chat.sendMessage(currentTurnPrompt));
                const response = result.response;
                
                const candidate = response.candidates?.[0];
                const parts = candidate?.content?.parts || [];
                
                // Add the model's turn to history
                activeHistory.push({
                    role: 'model',
                    parts: parts
                });

                const textPart = parts.find(p => p.text);
                if (textPart && textPart.text) {
                    this.logger.debug(`[GeminiLoop] Received text: ${textPart.text.substring(0, 50)}...`);
                    responseText += (responseText ? '\n\n' : '') + textPart.text;
                }


                const functionCalls = parts.filter(p => p.functionCall);
                if (functionCalls.length === 0) {
                    this.logger.debug(`[GeminiLoop] No tool calls, breaking.`);
                    break;
                }

                calls++;
                this.logger.log(`[GeminiLoop] Executing ${functionCalls.length} tool calls...`);
                const toolResultsParts: any[] = [];

                for (const part of functionCalls) {
                    const { name, args } = part.functionCall!;
                    this.logger.debug(`[GeminiLoop] Executing: ${name}`);
                    const actionResult = await this.executeTool(name, args, context, language);
                    let toolResult = actionResult.success ? actionResult.data : actionResult.error;

                    if (toolResult?.url) {
                        generatedFiles.push({ url: toolResult.url, fileName: toolResult.url.split('/').pop() });
                    }

                    // Gemini requirement: response MUST be a JSON object (Struct)
                    let responseContent = toolResult;
                    if (typeof toolResult !== 'object' || toolResult === null || Array.isArray(toolResult)) {
                        responseContent = { result: toolResult };
                    }

                    toolResultsParts.push({
                        functionResponse: {
                            name,
                            response: responseContent
                        }
                    });

                }

                // Add tool results to history
                activeHistory.push({
                    role: 'function',
                    parts: toolResultsParts
                });
            }


            const banner = this.systemDegradation.getWarningBanner(language);
            if (banner) responseText = banner + responseText;

            await this.prisma.chatMessage.create({
                data: {
                    chatHistoryId: chatId,
                    role: 'assistant',
                    content: responseText,
                }
            });

            return { response: responseText, chatId, generatedFiles };
        } catch (error: any) {
            this.logger.error(`Gemini loop failed: ${error.message}`);
            throw error;
        }
    }

    private buildConversationContext(history: any[], effectiveContext: any): ConversationContext {
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
                this.logger.log(`[GeminiLoop] Tool ${toolRespPart.functionResponse?.name} returned result. Length: ${JSON.stringify(resp).length}`);
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
        classification?: ClassificationResult
    ): Promise<string> {
        const persona = getPersonaByRole(context.role || UserRole.UNIDENTIFIED);
        const skill = classification ? getSkillByIntent(classification.intent) : undefined;
        const isSw = language === 'sw';
        const now = new Date();

        return `[SYSTEM CONTEXT]
- IDENTITY: ${persona.name}
- CONSTITUTION: ${skill?.persona_id ? MASTER_PERSONAS[skill.persona_id].constitution : persona.constitution}
- BEHAVIOURAL RULES: ${persona.behavioral_rules.join(' | ')}
- TARGET LANGUAGE: ${isSw ? 'Swahili' : 'English'}
- CURRENT_TIME: ${now.toISOString()}
- SKILL INSTRUCTIONS: ${skill ? (isSw ? skill.language_variants.sw : skill.language_variants.en) : 'None'}

User Message: ${message}`;
    }

    async summarizeForWhatsApp(text: string, language: string = 'en'): Promise<string> {
        try {
            const model = this.genAI.getGenerativeModel({ model: this.modelName });
            const prompt = language === 'sw' 
                ? `Fupisha ujumbe huu wa WhatsApp: ${text}`
                : `Summarize this WhatsApp message: ${text}`;
            const result = await withRetry(() => model.generateContent(prompt));
            return result.response.text().trim();
        } catch (e) {
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
        this.logger.log(`Feedback received for message ${messageId}: ${score} - ${note}`);
        
        try {
            await this.prisma.chatMessage.update({
                where: { id: messageId },
                data: {
                    feedbackScore: score,
                    feedbackNote: note,
                }
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


    // WhatsApp orchestration passthrough for legacy callers/tests
    async handleIncomingWhatsapp(phone: string, text?: string, mediaId?: string, mimeType?: string) {
        return this.whatsappOrchestrator.handleIncomingWhatsapp(phone, text, mediaId, mimeType);
    }

    private async handlePlanningFlow(
        chatId: string,
        message: string,
        history: any[],
        context: any,
        language: string,
        classification?: ClassificationResult
    ): Promise<{ response: string; chatId: string; interactive?: any }> {
        const planningPrompt = `
            You are a senior task planner for Aedra Property Management.
            The user has provided a complex, multi-step request: "${message}"
            
            YOUR JOB: Break this down into 3-7 clear, actionable steps.
            Language: ${language === 'sw' ? 'Swahili' : 'English'}
            
            Format your response as a professional numbered list.
            If in Swahili, ensure the plan is in Swahili.
            Start with: "I've broken this down into a step-by-step plan:" (or Swahili equivalent)
        `;

        const model = this.genAI.getGenerativeModel({ model: this.modelName });
        const result = await withRetry(() => model.generateContent(planningPrompt));
        const plan = result.response.text();

        // Persist the plan as an assistant message
        await this.prisma.chatMessage.create({
            data: {
                chatHistoryId: chatId,
                role: 'assistant',
                content: plan,
            }
        });

        // Add a confirmation menu
        const menuMessage = language === 'sw' 
            ? "\n\nUngependa niendelee na mpango huu?" 
            : "\n\nWould you like me to proceed with this plan?";
        
        const options = language === 'sw'
            ? [
                { key: '1', label: 'Ndiyo, Endelea', action: 'execute_plan' },
                { key: '2', label: 'Hapana, Ghairi', action: 'cancel_plan' }
              ]
            : [
                { key: '1', label: 'Yes, Proceed', action: 'execute_plan' },
                { key: '2', label: 'No, Cancel', action: 'cancel_plan' }
              ];

        const interactive = {
            type: 'button',
            body: { text: (plan.slice(-100) + menuMessage).trim().slice(0, 1024) }, // Body must be < 1024
            action: {
                buttons: options.slice(0, 3).map(o => ({
                    type: 'reply',
                    reply: { id: o.action, title: o.label.slice(0, 20) } // Title must be < 20
                }))
            }
        };

        // Store the original request in the session so we can execute it upon confirmation
        await this.syncSessionOptions(context.userId, options, context.phone);
        
        const uid = getSessionUid(context);
        const sessionKey = `ai_session:${uid}`;
        const session = await this.cacheManager.get<any>(sessionKey) || { userId: uid };
        session.pendingComplexTask = {
            message,
            classification,
            context
        };
        await this.cacheManager.set(sessionKey, session, 3600 * 1000);

        return { response: plan, chatId, interactive };
    }

    async executePlan(userId: string, phone: string): Promise<{ response: string; chatId: string; interactive?: any }> {
        const uid = getSessionUid({ userId, phone });
        const sessionKey = `ai_session:${uid}`;
        const session = await this.cacheManager.get<any>(sessionKey);
        
        if (!session || !session.pendingComplexTask) {
            return { response: "No pending plan found.", chatId: '' };
        }

        const { message, classification, context } = session.pendingComplexTask;
        delete session.pendingComplexTask;
        await this.cacheManager.set(sessionKey, session, 3600 * 1000);

        // Execute the original request now
        this.logger.log(`Executing approved plan for ${uid}`);
        
        const history = await this.getChatHistory(context.chatId);
        const normalizedHistory = this.normalizeHistory(history.slice(-15));
        
        const intent = (classification?.intent as any) || 'write';
        return this.executeGeminiToolLoop(context.chatId, message, normalizedHistory, intent, context, classification?.language || 'en', classification);
    }
}
