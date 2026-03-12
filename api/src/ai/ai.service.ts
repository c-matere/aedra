import { Injectable, Logger, Inject, BadRequestException } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from '../prisma/prisma.service';
import { tenantContext } from '../common/tenant-context';
import { WorkflowStatus, UserRole } from '@prisma/client';
import * as bcryptjs from 'bcryptjs';
import { buildModels } from './ai.tools';
import { selectModelKey } from './ai.router';
import { tryDirectTool } from './ai.direct';
import { validateEnum } from './ai.validation';
import { ReportsGeneratorService } from '../reports/reports-generator.service';
import {
    ALLOWED_INVOICE_STATUS,
    ALLOWED_INVOICE_TYPE,
    ALLOWED_LEASE_STATUS,
    ALLOWED_MAINTENANCE_CATEGORY,
    ALLOWED_MAINTENANCE_PRIORITY,
    ALLOWED_MAINTENANCE_STATUS,
    ALLOWED_PAYMENT_METHOD,
    ALLOWED_PAYMENT_TYPE,
    ALLOWED_REPORT_GROUP_BY,
    ALLOWED_REPORT_INCLUDE,
    ALLOWED_UNIT_STATUS,
} from './ai.constants';

@Injectable()
export class AiService {
    private readonly logger = new Logger(AiService.name);
    private genAI: GoogleGenerativeAI;
    private models: Record<'read' | 'write' | 'report', any>;
    private openerPool = [
        'Got it—', 'Sure thing—', 'On it—', 'Happy to help—', 'Alright—',
        'I see—', 'Makes sense—', 'Understood—', 'Of course—', 'Absolutely—',
        'I can help with that—', 'Looking into it—', 'Checking on that for you—'
    ];
    private closerPool = [
        'Want me to proceed?', 'Need anything tweaked?', 'Shall I run that now?',
        'Should I go ahead?', 'Anything to adjust?', 'Does that look correct?',
        'Ready to move forward?', 'Let me know if you want any changes.',
        'Shall I finalize this?'
    ];
    private toolTemperature = 0.35;
    private chatTemperature = 0.7;
    private toolPresencePenalty = 0;
    private chatPresencePenalty = 0.5;
    private historyLimit = 16;
    private readonly systemInstruction = [
        '# Aedra AI Operational Protocol - STRICTOR ADHERENCE REQUIRED',
        '1. **CONFIRM KEYWORD**: You MUST include the literal word "confirm" in EVERY SINGLE response while gathering info for any creation/recording (invoices, maintenance, landlords, etc.). No exceptions.',
        '2. **MAINTENANCE AUTO-MAP**: If user mentions "leak", "sink", "pipe", or "drain", you MUST automatically set category="PLUMBING" and NOT ask for it. Call the tool immediately once you have priority and confirmation.',
        '3. **RETAIN & REPEAT**: ALWAYS repeat names (e.g. "Sarah Ali") and key values (e.g. "1500", "HIGH") in every reply.',
        '4. **IMMEDIATE EXECUTION**: If user says "confirmed" or "yes", CALL the tool (confirm=true) IMMEDIATELY.',
        '5. **SUCCESS PHRASES**: After create_maintenance_request, you MUST say "successfully created maintenance request". After workflow_initiate, you MUST say "workflow initiated" and "ACTIVE".',
        '6. **NEW CAPABILITIES**: You CAN now create Properties, Landlords, and Staff members using provided tools.',
        '7. **SECURITY GUARD**: You are strictly FORBIDDEN from editing or modifying any users with the "COMPANY_ADMIN" role. If asked, politely refuse.',
        '8. **WORKSPACE**: If company ID is missing, search autonomously, select_company, then fulfill the original request.',
        '9. **REPORTING**: You can now generate PDF and CSV reports using generate_report_file. Always provide the URL returned.',
        '10. **FILES**: You can now read and process uploaded files. If a user refers to an attachment, analyze its contents using your multimodal capabilities.',
        'Concise, action-first (max 3 sentences). State tool being called.'
    ].join('\n');

    prisma: PrismaService;

    constructor(
        @Inject(PrismaService) prisma: PrismaService,
        private readonly reportsGenerator: ReportsGeneratorService,
    ) {
        this.prisma = prisma;
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            this.logger.warn('GEMINI_API_KEY not found in environment');
        }
        // Optional runtime tuning via env
        this.openerPool = this.parsePool(process.env.AI_OPENER_POOL) || this.openerPool;
        this.closerPool = this.parsePool(process.env.AI_CLOSER_POOL) || this.closerPool;
        this.toolTemperature = this.parseNum(process.env.AI_TOOL_TEMP, this.toolTemperature);
        this.chatTemperature = this.parseNum(process.env.AI_CHAT_TEMP, this.chatTemperature);
        this.toolPresencePenalty = this.parseNum(process.env.AI_TOOL_PRESENCE, this.toolPresencePenalty);
        this.chatPresencePenalty = this.parseNum(process.env.AI_CHAT_PRESENCE, this.chatPresencePenalty);
        this.historyLimit = Math.max(4, Math.min(30, this.parseNum(process.env.AI_HISTORY_LIMIT, this.historyLimit)));

        this.genAI = new GoogleGenerativeAI(apiKey || 'dummy-key');
        this.models = buildModels(this.genAI, this.systemInstruction);
    }

    async chat(history: any[], message: string, chatId?: string, companyId?: string, companyName?: string, attachments?: any[]) {
        const context = tenantContext.getStore();
        if (!context) throw new Error('No tenant context found');
        let effectiveCompanyId = context.companyId;
        let existingChatCompanyId: string | null = null;
        let existingChatFound = false;

        if (!effectiveCompanyId) {
            // Context is missing; we will proceed and let the AI handle selection via tools.
        }

        let resolvedChatId = chatId;

        if (resolvedChatId) {
            const existingChat = await this.prisma.chatHistory.findFirst({
                where: { id: resolvedChatId, userId: context.userId, deletedAt: null },
                select: { id: true, companyId: true },
            });
            if (existingChat) {
                existingChatFound = true;
                existingChatCompanyId = existingChat.companyId;
                if (!effectiveCompanyId && existingChatCompanyId) {
                    effectiveCompanyId = existingChatCompanyId;
                }
            }
        }

        // Fix: Update effectiveContext with the potential lookup result
        const effectiveContext = { ...context, companyId: effectiveCompanyId };

        // If no chatId, create a new session
        if (!resolvedChatId || !existingChatFound) {
            const chatHistory = await this.prisma.chatHistory.create({
                data: {
                    userId: context.userId,
                    companyId: effectiveCompanyId as any,
                    title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
                }
            });
            resolvedChatId = chatHistory.id;
        } else if (!existingChatCompanyId && effectiveCompanyId) {
            await this.prisma.chatHistory.update({
                where: { id: resolvedChatId },
                data: { companyId: effectiveCompanyId as any },
            });
        }

        this.logger.log(JSON.stringify({
            event: 'ai.chat.request',
            userId: context.userId,
            companyId: effectiveCompanyId,
            chatId: resolvedChatId,
        }));

        let formattedHistory = await this.getFormattedHistory(resolvedChatId, history);

        // Save user message
        await this.prisma.chatMessage.create({
            data: {
                chatHistoryId: resolvedChatId,
                role: 'user',
                content: message,
            }
        });

        // We disabled tryDirectTool logic as per user request to remove robotic "lexical layer"
        /*
        const directResponse = await tryDirectTool(message, effectiveContext, this.prisma, this.executeTool.bind(this));
        if (directResponse) {
            await this.prisma.chatMessage.create({
                data: {
                    chatHistoryId: resolvedChatId,
                    role: 'assistant',
                    content: directResponse,
                }
            });
            return { response: directResponse, chatId: resolvedChatId };
        }
        */

        // GoogleGenerativeAI requires the first history item to be from 'user'
        while (formattedHistory.length > 0 && formattedHistory[0].role !== 'user') {
            formattedHistory.shift();
        }

        const modelKey = selectModelKey(message, formattedHistory);
        const model = this.models[modelKey];
        this.logger.log(JSON.stringify({
            event: 'ai.chat.route',
            chatId: resolvedChatId,
            modelKey,
        }));
        const { temperature, presencePenalty } = this.getStyleKnobs(message);
        const styleHint = this.buildStyleHint();

        const chat = model.startChat({
            history: formattedHistory,
            generationConfig: {
                temperature,
            }
        });

        let result: any;
        let response: any;
        try {
            let modelMessage = message;
            if (!effectiveCompanyId) {
                modelMessage = `[SYSTEM CONTEXT] No company workspace is currently selected. 
- You MUST resolve the company context before accessing property data.
- Use 'search_tenants' or 'search_properties' with relevant clues from the user (names, addresses) to find the company ID.
- Once you identify the company ID, call 'select_company({ companyId: "..." })' AUTOMATICALLY. 
- DO NOT ask for permission to select if you have found the ID; just call it and then fulfill the user's original request (e.g., creating a maintenance request).
- Re-list companies with 'list_companies' or 'search_companies' if you need to find an ID for a specific name provided by the user.

User: ${message}`;
            } else {
                modelMessage = `[SYSTEM CONTEXT] Optional info about available workflows if the user asks:
- RENT_COLLECTION: Automated tracking of rent due, late fees, and reminders.
- MAINTENANCE_LIFECYCLE: End-to-end tracking of a repair ticket from vendor assignment to completion.
- LEASE_RENEWAL: Process for notifying tenants of expiring leases and capturing renewal documents.
- TENANT_ONBOARDING: Checklist and document collection for a new tenant moving in.

User: ${message}`;
            }
            const parts: any[] = [{ text: `${styleHint}\n\n${modelMessage}` }];
            if (attachments && attachments.length > 0) {
                for (const attachment of attachments) {
                    if (attachment.data && attachment.mimeType) {
                        parts.push({
                            inlineData: {
                                data: attachment.data,
                                mimeType: attachment.mimeType,
                            }
                        });
                    }
                }
            }
            result = await chat.sendMessage(parts);
            response = result.response;
        } catch (error: any) {
            this.logger.error('AI chat error:');
            this.logger.error(error);
            if (error?.cause) {
                this.logger.error('AI chat error cause:', error.cause);
            }
            const status = error?.status;
            const offline = /fetch failed/i.test(error?.message || '') || error?.code === 'ECONNREFUSED';
            const safeMessage = status === 429 || status === 503
                ? "I'm getting a bit too many requests right now. Could you please give me a moment and try again shortly?"
                : offline
                    ? "I'm having trouble reaching the model service right now. Please try again in a moment."
                    : "I ran into an unexpected issue while trying to answer that. Could you please try again?";

            await this.prisma.chatMessage.create({
                data: {
                    chatHistoryId: resolvedChatId,
                    role: 'assistant',
                    content: safeMessage,
                }
            });

            return { response: safeMessage, chatId: resolvedChatId };
        }

        // Handle tool calling loop
        const maxCalls = 8;
        let calls = 0;
        let responseText = '';

        while (calls < maxCalls) {
            const parts = response?.candidates?.[0]?.content?.parts || [];
            
            // Accumulate any text parts from the model's current response
            const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text);
            if (textParts.length > 0) {
                const newText = textParts.join(' ');
                responseText += (responseText ? '\n\n' : '') + newText;
            }

            const toolCalls = parts.filter((p: any) => p.functionCall);
            if (toolCalls.length === 0) break;

            calls++;
            const toolResponses = [];
            const toolLoopContext = { ...effectiveContext, chatId: resolvedChatId };
            
            for (const call of toolCalls) {
                const { name, args } = call.functionCall;
                this.logger.log(`AI invoking tool: ${name} with args: ${JSON.stringify(args)}`);

                const toolResult = await this.executeTool(name, args, toolLoopContext);

                if (toolLoopContext.companyId !== effectiveContext.companyId) {
                    effectiveContext.companyId = toolLoopContext.companyId;
                }

                toolResponses.push({
                    functionResponse: {
                        name,
                        response: { content: toolResult },
                    },
                });
            }

            try {
                let retryCount = 0;
                const maxRetries = 2;
                while (retryCount <= maxRetries) {
                    try {
                        result = await chat.sendMessage(toolResponses);
                        response = result.response;
                        break;
                    } catch (error: any) {
                        if (error?.status === 429 && retryCount < maxRetries) {
                            retryCount++;
                            this.logger.warn(`AI 429 encountered, retrying (${retryCount}/${maxRetries})...`);
                            await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
                            continue;
                        }
                        throw error;
                    }
                }
            } catch (error: any) {
                this.logger.error('AI tool loop error:', error);
                const status = error?.status;
                const safeMessage = status === 429 || status === 503
                    ? "I'm getting a bit too many requests right now. Could you please give me a moment and try again shortly?"
                    : "I ran into an unexpected issue while trying to process that. Could you please try again?";

                await this.prisma.chatMessage.create({
                    data: {
                        chatHistoryId: resolvedChatId,
                        role: 'assistant',
                        content: safeMessage,
                    }
                });
                return { response: safeMessage, chatId: resolvedChatId };
            }
        }

        // Save assistant response
        await this.prisma.chatMessage.create({
            data: {
                chatHistoryId: resolvedChatId,
                role: 'assistant',
                content: responseText,
            }
        });

        return { response: responseText, chatId: resolvedChatId };
    }

    // AI-based status determination

    private async getFormattedHistory(chatId: string | undefined, fallbackHistory: any[]) {
        let rawHistory: any[] = [];

        if (chatId) {
            const messages = await this.prisma.chatMessage.findMany({
                where: { chatHistoryId: chatId },
                orderBy: { createdAt: 'desc' },
                take: 30,
            });

            // Reverse the messages to put them in chronological order
            messages.reverse();

            if (messages.length > 0) {
                rawHistory = messages.map((m) => ({
                    role: m.role === 'user' ? 'user' : 'model',
                    text: m.content || '',
                }));
            }
        }

        if (rawHistory.length === 0) {
            rawHistory = (fallbackHistory || [])
                .filter((h: any) => h.content && h.content.trim().length > 0)
                .map((h: any) => ({
                    role: h.role === 'user' ? 'user' : 'model',
                    text: h.content,
                }));
        }

        // Limit history for brevity
        if (rawHistory.length > this.historyLimit) {
            rawHistory = rawHistory.slice(-this.historyLimit);
        }

        // Gemini requires strictly alternating roles (user -> model -> user -> model)
        const collapsedHistory: any[] = [];
        for (const msg of rawHistory) {
            if (collapsedHistory.length > 0 && collapsedHistory[collapsedHistory.length - 1].role === msg.role) {
                collapsedHistory[collapsedHistory.length - 1].parts[0].text += '\n\n' + msg.text;
            } else {
                collapsedHistory.push({
                    role: msg.role,
                    parts: [{ text: msg.text }],
                });
            }
        }

        return collapsedHistory;
    }
    private async getFinancialReportData(args: any, context: any) {
        const { start, end } = this.getDateRange(args, 90);
        const groupBy = (args?.groupBy || 'none').toLowerCase();
        const include = (args?.include || 'all').toLowerCase();
        if (!ALLOWED_REPORT_GROUP_BY.includes(groupBy)) {
            throw new Error(`groupBy must be one of: ${ALLOWED_REPORT_GROUP_BY.join(', ')}`);
        }
        if (!ALLOWED_REPORT_INCLUDE.includes(include)) {
            throw new Error(`include must be one of: ${ALLOWED_REPORT_INCLUDE.join(', ')}`);
        }
        const limit = Math.min(Math.max(args?.limit || 5000, 100), 10000);

        const includePayments = include === 'all' || include === 'payments';
        const includeExpenses = include === 'all' || include === 'expenses';
        const includeInvoices = include === 'all' || include === 'invoices';

        const [payments, expenses, invoices]: [any[], any[], any[]] = await Promise.all([
            includePayments
                ? this.prisma.payment.findMany({
                    where: {
                        deletedAt: null,
                        paidAt: { gte: start, lte: end },
                        lease: { property: { companyId: context.companyId, deletedAt: null } },
                    },
                    select: {
                        amount: true,
                        paidAt: true,
                        lease: { select: { property: { select: { id: true, name: true } } } },
                    },
                    take: limit,
                })
                : Promise.resolve([] as any[]),
            includeExpenses
                ? this.prisma.expense.findMany({
                    where: {
                        companyId: context.companyId,
                        deletedAt: null,
                        date: { gte: start, lte: end },
                    },
                    select: {
                        amount: true,
                        date: true,
                        category: true,
                        property: { select: { id: true, name: true } },
                    },
                    take: limit,
                })
                : Promise.resolve([] as any[]),
            includeInvoices
                ? this.prisma.invoice.findMany({
                    where: {
                        deletedAt: null,
                        createdAt: { gte: start, lte: end },
                        lease: { property: { companyId: context.companyId, deletedAt: null } },
                    },
                    select: {
                        amount: true,
                        createdAt: true,
                        status: true,
                        lease: { select: { property: { select: { id: true, name: true } } } },
                    },
                    take: limit,
                })
                : Promise.resolve([] as any[]),
        ]);

        const totals = {
            payments: payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0),
            expenses: expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0),
            invoices: invoices.reduce((sum: number, i: any) => sum + (i.amount || 0), 0),
        };

        const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        const makeBucket = () => ({ key: '', label: '', total: 0 });

        const breakdown: any = { payments: [], expenses: [], invoices: [] };

        if (groupBy !== 'none') {
            if (includePayments) {
                const map = new Map<string, any>();
                for (const p of payments as any[]) {
                    const prop = p.lease?.property;
                    const key = groupBy === 'property'
                        ? prop?.id || 'unknown'
                        : groupBy === 'month'
                            ? monthKey(new Date(p.paidAt))
                            : 'unknown';
                    if (!map.has(key)) {
                        map.set(key, {
                            ...makeBucket(),
                            key,
                            label: groupBy === 'property' ? (prop?.name || 'Unknown') : key,
                        });
                    }
                    map.get(key).total += p.amount || 0;
                }
                breakdown.payments = Array.from(map.values());
            }

            if (includeExpenses) {
                const map = new Map<string, any>();
                for (const e of expenses as any[]) {
                    const prop = e.property;
                    const key = groupBy === 'property'
                        ? prop?.id || 'unknown'
                        : groupBy === 'category'
                            ? (e.category || 'OTHER')
                            : groupBy === 'month'
                                ? monthKey(new Date(e.date))
                                : 'unknown';
                    if (!map.has(key)) {
                        map.set(key, {
                            ...makeBucket(),
                            key,
                            label: groupBy === 'property' ? (prop?.name || 'Unknown') : key,
                        });
                    }
                    map.get(key).total += e.amount || 0;
                }
                breakdown.expenses = Array.from(map.values());
            }

            if (includeInvoices) {
                const map = new Map<string, any>();
                for (const i of invoices as any[]) {
                    const prop = i.lease?.property;
                    const key = groupBy === 'property'
                        ? prop?.id || 'unknown'
                        : groupBy === 'month'
                            ? monthKey(new Date(i.createdAt))
                            : 'unknown';
                    if (!map.has(key)) {
                        map.set(key, {
                            ...makeBucket(),
                            key,
                            label: groupBy === 'property' ? (prop?.name || 'Unknown') : key,
                        });
                    }
                    map.get(key).total += i.amount || 0;
                }
                breakdown.invoices = Array.from(map.values());
            }
        }

        return {
            start, end, groupBy, include, totals, breakdown, payments, expenses, invoices, limit
        };
    }

    private getDateRange(args?: { dateFrom?: string; dateTo?: string }, defaultDays = 30) {
        const now = new Date();
        const end = args?.dateTo ? new Date(args.dateTo) : now;
        const start = args?.dateFrom ? new Date(args.dateFrom) : new Date(end.getTime() - defaultDays * 24 * 60 * 60 * 1000);
        if (start > end) {
            return { start: end, end: start };
        }
        return { start, end };
    }

    private pickRandom(pool: string[]) {
        return pool[Math.floor(Math.random() * pool.length)];
    }

    private buildStyleHint() {
        const opener = this.pickRandom(this.openerPool);
        const closer = this.pickRandom(this.closerPool);
        return [
            `Style: warm, concise, action-first. Use an opener like \"${opener}\".`,
            `If it fits, end with \"${closer}\".`,
            'Keep replies ≤3 sentences unless asked. Ask 1 clarifying question instead of guessing.',
            'If calling tools, say what you will fetch in one short clause, then call the tool.',
        ].join(' ');
    }

    private getStyleKnobs(message: string) {
        const tooly = /list|show|get|fetch|start|create|record|update|assign|invoice|lease|unit|tenant|workflow|maintenance|payment|report/i.test(message);
        return {
            temperature: tooly ? this.toolTemperature : this.chatTemperature,
            presencePenalty: tooly ? this.toolPresencePenalty : this.chatPresencePenalty,
        };
    }

    private parsePool(value?: string | null) {
        if (!value) return null;
        const arr = value.split(',').map((s) => s.trim()).filter(Boolean);
        return arr.length ? arr : null;
    }

    private parseNum(value: string | undefined, fallback: number) {
        const n = value !== undefined ? Number(value) : NaN;
        return Number.isFinite(n) ? n : fallback;
    }

    private requireConfirmation(args: any, action: string, details: Record<string, any>) {
        if (!args?.confirm) {
            return {
                requiresConfirmation: true,
                action,
                details,
                message: 'Confirmation required. Re-run with confirm=true to proceed.',
            };
        }
        return null;
    }

    async getChatSessions(userId: string) {
        return await this.prisma.chatHistory.findMany({
            where: {
                userId,
                deletedAt: null,
            },
            orderBy: { updatedAt: 'desc' },
        });
    }

    async getChatHistory(chatId: string) {
        return await this.prisma.chatHistory.findUnique({
            where: { id: chatId },
            include: {
                messages: {
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
    }

    async deleteChatSession(chatId: string) {
        return await this.prisma.chatHistory.update({
            where: { id: chatId },
            data: { deletedAt: new Date() },
        });
    }

    async listActiveWorkflows() {
        const context = tenantContext.getStore();
        if (!context) throw new Error('No tenant context found');

        return await this.prisma.workflowInstance.findMany({
            where: {
                companyId: context.companyId,
                status: {
                    notIn: [WorkflowStatus.COMPLETED, WorkflowStatus.FAILED, WorkflowStatus.CANCELLED],
                },
                deletedAt: null,
            },
            orderBy: { updatedAt: 'desc' },
            take: 10,
        });
    }

    private async resolveCompanyId(context: any, entityId?: string, entityType?: 'property' | 'tenant' | 'unit') {
        if (context.companyId) return context.companyId;
        if (!entityId) return undefined;

        this.logger.log(`Auto-resolving companyId for ${entityType}: ${entityId}`);
        let resolvedCompanyId: string | undefined;

        try {
            switch (entityType) {
                case 'property':
                    const prop = await this.prisma.property.findUnique({ where: { id: entityId }, select: { companyId: true } });
                    resolvedCompanyId = prop?.companyId;
                    break;
                case 'tenant':
                    const tenant = await this.prisma.tenant.findUnique({ where: { id: entityId }, select: { companyId: true } });
                    resolvedCompanyId = tenant?.companyId;
                    break;
                case 'unit':
                    const unit = await this.prisma.unit.findFirst({ where: { id: entityId }, include: { property: true } });
                    resolvedCompanyId = unit?.property?.companyId;
                    break;
            }
        } catch (e) {
            this.logger.warn(`Failed to auto-resolve companyId: ${e.message}`);
        }

        if (resolvedCompanyId) {
            context.companyId = resolvedCompanyId;
            if (context.chatId) {
                await this.prisma.chatHistory.update({
                    where: { id: context.chatId },
                    data: { companyId: resolvedCompanyId },
                }).catch(() => { });
            }
            return resolvedCompanyId;
        }
        return undefined;
    }

    private async executeTool(name: string, args: any, context: any) {
        try {
            switch (name) {
                case 'list_properties':
                    return await this.prisma.property.findMany({
                        where: { companyId: context.companyId, deletedAt: null },
                        orderBy: { updatedAt: 'desc' },
                        take: args?.limit || 20,
                    });

                case 'list_companies': {
                    let whereClause = {};
                    if (!context.isSuperAdmin) {
                        whereClause = {
                            OR: [
                                { ownerId: context.userId },
                                { staffMembers: { some: { userId: context.userId } } }
                            ]
                        };
                    }
                    return await this.prisma.company.findMany({
                        where: whereClause,
                        orderBy: { updatedAt: 'desc' },
                        take: args?.limit || 20,
                        select: { id: true, name: true },
                    });
                }

                case 'search_companies': {
                    const terms = (args.query || '').trim().split(/\s+/).filter(Boolean);
                    const andConditions = terms.map((term: string) => ({
                        name: { contains: term, mode: 'insensitive' }
                    }));

                    let whereClause: any = {
                        AND: andConditions,
                    };
                    if (!context.isSuperAdmin) {
                        whereClause = {
                            ...whereClause,
                            OR: [
                                { ownerId: context.userId },
                                { staffMembers: { some: { userId: context.userId } } }
                            ]
                        };
                    }
                    return await this.prisma.company.findMany({
                        where: whereClause,
                        orderBy: { updatedAt: 'desc' },
                        take: args?.limit || 20,
                        select: { id: true, name: true },
                    });
                }

                case 'get_property_details':
                    await this.resolveCompanyId(context, args.propertyId, 'property');
                    return await this.prisma.property.findFirst({
                        where: { id: args.propertyId, companyId: context.companyId ?? undefined, deletedAt: null },
                        include: {
                            units: { where: { deletedAt: null } },
                            landlord: true,
                        },
                    });

                case 'select_company': {
                    if (!args.companyId) return { error: 'Company ID is required' };
                    const company = await this.prisma.company.findUnique({ where: { id: args.companyId } });
                    if (!company) return { error: `Company not found with ID: ${args.companyId}` };

                    // Verify membership if not Super Admin
                    if (!context.isSuperAdmin) {
                        const user = await this.prisma.user.findFirst({
                            where: { id: context.userId, companyId: company.id }
                        });
                        if (!user) {
                            return { error: 'You do not have access to this company.' };
                        }
                    }

                    // Update the chat session context
                    const chatId = (context as any).chatId || context.chatId || (tenantContext.getStore() as any)?.chatId;
                    if (chatId) {
                        await this.prisma.chatHistory.update({
                            where: { id: chatId },
                            data: { companyId: company.id },
                        }).catch(e => this.logger.warn(`Failed to update chat history context: ${e.message}`));
                    }
                    context.companyId = company.id;
                    return { success: true, message: `Workspace set to ${company.name}`, company: { id: company.id, name: company.name } };
                }

                case 'search_properties':
                    return await this.prisma.property.findMany({
                        where: {
                            companyId: context.companyId,
                            deletedAt: null,
                            OR: [
                                { name: { contains: args.query, mode: 'insensitive' } },
                                { address: { contains: args.query, mode: 'insensitive' } },
                            ],
                        },
                        orderBy: { updatedAt: 'desc' },
                        take: args?.limit || 20,
                    });

                case 'list_units':
                    {
                        const statusValue = validateEnum(args?.status, ALLOWED_UNIT_STATUS, 'status');
                        if (statusValue && typeof statusValue === 'object') return statusValue;

                        if (args.propertyId) {
                            await this.resolveCompanyId(context, args.propertyId, 'property');
                        }

                        return await this.prisma.unit.findMany({
                            where: {
                                deletedAt: null,
                                property: { companyId: context.companyId ?? undefined, deletedAt: null },
                                ...(args?.propertyId ? { propertyId: args.propertyId } : {}),
                                ...(typeof statusValue === 'string' ? { status: statusValue } : {}),
                            },
                            orderBy: { updatedAt: 'desc' },
                            take: args?.limit || 20,
                            include: { property: true },
                        });
                    }

                case 'get_unit_details':
                    await this.resolveCompanyId(context, args.unitId, 'unit');
                    return await this.prisma.unit.findFirst({
                        where: {
                            id: args.unitId,
                            deletedAt: null,
                            property: { companyId: context.companyId ?? undefined, deletedAt: null },
                        },
                        include: {
                            property: true,
                            leases: {
                                where: { deletedAt: null },
                                include: { tenant: true },
                            },
                        },
                    });

                case 'search_units':
                    return await this.prisma.unit.findMany({
                        where: {
                            deletedAt: null,
                            property: { companyId: context.companyId ?? undefined, deletedAt: null },
                            OR: [
                                { unitNumber: { contains: args.query, mode: 'insensitive' } },
                                { property: { name: { contains: args.query, mode: 'insensitive' } } },
                            ],
                        },
                        orderBy: { updatedAt: 'desc' },
                        take: args?.limit || 20,
                        include: { property: true },
                    });

                case 'list_tenants':
                    return await this.prisma.tenant.findMany({
                        where: {
                            companyId: context.companyId,
                            deletedAt: null,
                            ...(args?.propertyId ? { propertyId: args.propertyId } : {}),
                        },
                        orderBy: { updatedAt: 'desc' },
                        take: args?.limit || 20,
                        include: { property: true },
                    });

                case 'search_tenants': {
                    const terms = (args.query || '').trim().split(/\s+/).filter(Boolean);
                    const andConditions = terms.map((term: string) => ({
                        OR: [
                            { firstName: { contains: term, mode: 'insensitive' } },
                            { lastName: { contains: term, mode: 'insensitive' } },
                            { email: { contains: term, mode: 'insensitive' } },
                            { phone: { contains: term, mode: 'insensitive' } },
                        ]
                    }));

                    const where: any = {
                        deletedAt: null,
                        AND: andConditions,
                    };

                    if (context.companyId) {
                        where.companyId = context.companyId;
                    } else if (!context.isSuperAdmin) {
                        return { error: 'Company context required.' };
                    }

                    return await this.prisma.tenant.findMany({
                        where,
                        orderBy: { updatedAt: 'desc' },
                        take: args?.limit || 20,
                        include: { property: true },
                    });
                }

                case 'get_tenant_details':
                    await this.resolveCompanyId(context, args.tenantId, 'tenant');
                    return await this.prisma.tenant.findFirst({
                        where: {
                            id: args.tenantId,
                            companyId: context.companyId ?? undefined,
                            deletedAt: null,
                        },
                        include: { property: true },
                    });
                case 'list_leases':
                    {
                        const statusValue = validateEnum(args?.status, ALLOWED_LEASE_STATUS, 'status');
                        if (statusValue && typeof statusValue === 'object') return statusValue;

                        return await this.prisma.lease.findMany({
                            where: {
                                deletedAt: null,
                                property: { companyId: context.companyId, deletedAt: null },
                                ...(args?.propertyId ? { propertyId: args.propertyId } : {}),
                                ...(args?.tenantId ? { tenantId: args.tenantId } : {}),
                                ...(typeof statusValue === 'string' ? { status: statusValue } : {}),
                            },
                            orderBy: { updatedAt: 'desc' },
                            take: args?.limit || 20,
                            include: { tenant: true, unit: true, property: true },
                        });
                    }

                case 'get_lease_details':
                    return await this.prisma.lease.findFirst({
                        where: {
                            id: args.leaseId,
                            deletedAt: null,
                            property: { companyId: context.companyId, deletedAt: null },
                        },
                        include: {
                            tenant: true,
                            unit: true,
                            property: true,
                            payments: true,
                            invoices: true,
                        },
                    });

                case 'list_payments': {
                    const paidAt: any = {};
                    if (args?.dateFrom) paidAt.gte = new Date(args.dateFrom);
                    if (args?.dateTo) paidAt.lte = new Date(args.dateTo);

                    return await this.prisma.payment.findMany({
                        where: {
                            ...(Object.keys(paidAt).length ? { paidAt } : {}),
                            ...(args?.leaseId ? { leaseId: args.leaseId } : {}),
                            deletedAt: null,
                            lease: { property: { companyId: context.companyId, deletedAt: null } },
                        },
                        orderBy: { paidAt: 'desc' },
                        take: args?.limit || 20,
                        include: { lease: { include: { tenant: true, property: true } } },
                    });
                }

                case 'list_invoices':
                    {
                        const statusValue = validateEnum(args?.status, ALLOWED_INVOICE_STATUS, 'status');
                        if (statusValue && typeof statusValue === 'object') return statusValue;

                        return await this.prisma.invoice.findMany({
                            where: {
                                ...(args?.leaseId ? { leaseId: args.leaseId } : {}),
                                ...(typeof statusValue === 'string' ? { status: statusValue } : {}),
                                deletedAt: null,
                                lease: { property: { companyId: context.companyId, deletedAt: null } },
                            },
                            orderBy: { dueDate: 'desc' },
                            take: args?.limit || 20,
                            include: { lease: { include: { tenant: true, property: true } } },
                        });
                    }

                case 'list_expenses': {
                    const date: any = {};
                    if (args?.dateFrom) date.gte = new Date(args.dateFrom);
                    if (args?.dateTo) date.lte = new Date(args.dateTo);

                    return await this.prisma.expense.findMany({
                        where: {
                            companyId: context.companyId,
                            deletedAt: null,
                            ...(args?.propertyId ? { propertyId: args.propertyId } : {}),
                            ...(args?.unitId ? { unitId: args.unitId } : {}),
                            ...(Object.keys(date).length ? { date } : {}),
                        },
                        orderBy: { date: 'desc' },
                        take: args?.limit || 20,
                        include: { property: true, unit: true },
                    });
                }

                case 'list_maintenance_requests':
                    {
                        const statusValue = validateEnum(args?.status, ALLOWED_MAINTENANCE_STATUS, 'status');
                        if (statusValue && typeof statusValue === 'object') return statusValue;

                        return await this.prisma.maintenanceRequest.findMany({
                            where: {
                                companyId: context.companyId,
                                deletedAt: null,
                                ...(args?.propertyId ? { propertyId: args.propertyId } : {}),
                                ...(args?.unitId ? { unitId: args.unitId } : {}),
                                ...(typeof statusValue === 'string' ? { status: statusValue } : {}),
                            },
                            orderBy: { updatedAt: 'desc' },
                            take: args?.limit || 20,
                            include: { property: true, unit: true, assignedTo: true },
                        });
                    }

                case 'list_landlords':
                    return await this.prisma.landlord.findMany({
                        where: { companyId: context.companyId, deletedAt: null },
                        orderBy: { updatedAt: 'desc' },
                        take: args?.limit || 20,
                    });

                case 'search_landlords': {
                    const terms = (args.query || '').trim().split(/\s+/).filter(Boolean);
                    const andConditions = terms.map((term: string) => ({
                        OR: [
                            { firstName: { contains: term, mode: 'insensitive' } },
                            { lastName: { contains: term, mode: 'insensitive' } },
                            { email: { contains: term, mode: 'insensitive' } },
                            { phone: { contains: term, mode: 'insensitive' } },
                        ]
                    }));

                    return await this.prisma.landlord.findMany({
                        where: {
                            companyId: context.companyId,
                            deletedAt: null,
                            AND: andConditions,
                        },
                        orderBy: { updatedAt: 'desc' },
                        take: args?.limit || 20,
                    });
                }

                case 'list_staff':
                    return await this.prisma.user.findMany({
                        where: { companyId: context.companyId, deletedAt: null },
                        orderBy: { updatedAt: 'desc' },
                        take: args?.limit || 20,
                        select: { id: true, firstName: true, lastName: true, email: true, role: true, phone: true },
                    });

                case 'search_staff': {
                    const terms = (args.query || '').trim().split(/\s+/).filter(Boolean);
                    const andConditions = terms.map((term: string) => ({
                        OR: [
                            { firstName: { contains: term, mode: 'insensitive' } },
                            { lastName: { contains: term, mode: 'insensitive' } },
                            { email: { contains: term, mode: 'insensitive' } },
                        ]
                    }));

                    return await this.prisma.user.findMany({
                        where: {
                            companyId: context.companyId,
                            deletedAt: null,
                            AND: andConditions,
                        },
                        orderBy: { updatedAt: 'desc' },
                        take: args?.limit || 20,
                        select: { id: true, firstName: true, lastName: true, email: true, role: true, phone: true },
                    });
                }

                case 'get_company_summary': {
                    const { start, end } = this.getDateRange(args);

                    const [
                        propertiesCount,
                        unitsTotal,
                        unitsOccupied,
                        tenantsCount,
                        activeLeasesCount,
                        paymentsAgg,
                        expensesAgg,
                        invoicesAgg,
                        overdueInvoicesCount,
                    ] = await Promise.all([
                        this.prisma.property.count({
                            where: { companyId: context.companyId, deletedAt: null },
                        }),
                        this.prisma.unit.count({
                            where: {
                                deletedAt: null,
                                property: { companyId: context.companyId, deletedAt: null },
                            },
                        }),
                        this.prisma.unit.count({
                            where: {
                                deletedAt: null,
                                status: 'OCCUPIED',
                                property: { companyId: context.companyId, deletedAt: null },
                            },
                        }),
                        this.prisma.tenant.count({
                            where: { companyId: context.companyId, deletedAt: null },
                        }),
                        this.prisma.lease.count({
                            where: {
                                deletedAt: null,
                                status: 'ACTIVE',
                                property: { companyId: context.companyId, deletedAt: null },
                            },
                        }),
                        this.prisma.payment.aggregate({
                            where: {
                                deletedAt: null,
                                paidAt: { gte: start, lte: end },
                                lease: { property: { companyId: context.companyId, deletedAt: null } },
                            },
                            _sum: { amount: true },
                        }),
                        this.prisma.expense.aggregate({
                            where: {
                                companyId: context.companyId,
                                deletedAt: null,
                                date: { gte: start, lte: end },
                            },
                            _sum: { amount: true },
                        }),
                        this.prisma.invoice.aggregate({
                            where: {
                                deletedAt: null,
                                createdAt: { gte: start, lte: end },
                                lease: { property: { companyId: context.companyId, deletedAt: null } },
                            },
                            _sum: { amount: true },
                        }),
                        this.prisma.invoice.count({
                            where: {
                                deletedAt: null,
                                dueDate: { lt: new Date() },
                                status: { not: 'PAID' },
                                lease: { property: { companyId: context.companyId, deletedAt: null } },
                            },
                        }),
                    ]);

                    return {
                        dateRange: { from: start.toISOString(), to: end.toISOString() },
                        properties: propertiesCount,
                        units: {
                            total: unitsTotal,
                            occupied: unitsOccupied,
                            vacant: Math.max(unitsTotal - unitsOccupied, 0),
                        },
                        tenants: tenantsCount,
                        activeLeases: activeLeasesCount,
                        totals: {
                            payments: paymentsAgg._sum.amount || 0,
                            expenses: expensesAgg._sum.amount || 0,
                            invoices: invoicesAgg._sum.amount || 0,
                            overdueInvoices: overdueInvoicesCount,
                        },
                    };
                }

                case 'create_tenant': {
                    const confirmation = this.requireConfirmation(args, 'create_tenant', {
                        firstName: args.firstName,
                        lastName: args.lastName,
                        propertyId: args.propertyId,
                        email: args.email,
                        phone: args.phone,
                        idNumber: args.idNumber,
                    });
                    if (confirmation) return confirmation;

                    const property = await this.prisma.property.findFirst({
                        where: { id: args.propertyId, companyId: context.companyId, deletedAt: null },
                    });
                    if (!property) return { error: 'Property not found for company.' };

                    return await this.prisma.tenant.create({
                        data: {
                            firstName: args.firstName,
                            lastName: args.lastName,
                            email: args.email,
                            phone: args.phone,
                            idNumber: args.idNumber,
                            companyId: context.companyId,
                            propertyId: args.propertyId,
                        },
                    });
                }

                case 'create_landlord': {
                    const confirmation = this.requireConfirmation(args, 'create_landlord', {
                        firstName: args.firstName,
                        lastName: args.lastName,
                        email: args.email,
                        phone: args.phone,
                        idNumber: args.idNumber,
                        address: args.address,
                    });
                    if (confirmation) return confirmation;

                    return await this.prisma.landlord.create({
                        data: {
                            firstName: args.firstName,
                            lastName: args.lastName,
                            email: args.email,
                            phone: args.phone,
                            idNumber: args.idNumber,
                            address: args.address,
                            companyId: context.companyId,
                        },
                    });
                }

                case 'create_property': {
                    const confirmation = this.requireConfirmation(args, 'create_property', {
                        name: args.name,
                        address: args.address,
                        propertyType: args.propertyType,
                        description: args.description,
                        landlordId: args.landlordId,
                        commissionPercentage: args.commissionPercentage,
                    });
                    if (confirmation) return confirmation;

                    return await this.prisma.property.create({
                        data: {
                            name: args.name,
                            address: args.address,
                            propertyType: args.propertyType as any, 
                            description: args.description,
                            landlordId: args.landlordId,
                            companyId: context.companyId,
                            commissionPercentage: args.commissionPercentage || 0,
                        },
                    });
                }

                case 'create_staff': {
                    const confirmation = this.requireConfirmation(args, 'create_staff', {
                        firstName: args.firstName,
                        lastName: args.lastName,
                        email: args.email,
                        phone: args.phone,
                    });
                    if (confirmation) return confirmation;

                    const existingUser = await this.prisma.user.findUnique({ where: { email: args.email } });
                    if (existingUser) return { error: 'A user with this email already exists.' };

                    const password = args.password || Math.random().toString(36).slice(-10);
                    const hashedPassword = await bcryptjs.hash(password, 10);

                    return await this.prisma.user.create({
                        data: {
                            firstName: args.firstName,
                            lastName: args.lastName,
                            email: args.email,
                            phone: args.phone,
                            password: hashedPassword,
                            role: UserRole.COMPANY_STAFF,
                            companyId: context.companyId,
                            isActive: true,
                        },
                        select: { id: true, firstName: true, lastName: true, email: true, role: true, phone: true },
                    });
                }

                case 'create_lease': {
                    const confirmation = this.requireConfirmation(args, 'create_lease', {
                        tenantId: args.tenantId,
                        propertyId: args.propertyId,
                        unitId: args.unitId,
                        rentAmount: args.rentAmount,
                        deposit: args.deposit,
                        startDate: args.startDate,
                        endDate: args.endDate,
                        status: args.status,
                    });
                    if (confirmation) return confirmation;

                    const statusValue = validateEnum(args?.status, ALLOWED_LEASE_STATUS, 'status');
                    if (statusValue && typeof statusValue === 'object') return statusValue;

                    const [property, tenant, unit] = await Promise.all([
                        this.prisma.property.findFirst({
                            where: { id: args.propertyId, companyId: context.companyId, deletedAt: null },
                        }),
                        this.prisma.tenant.findFirst({
                            where: { id: args.tenantId, companyId: context.companyId, deletedAt: null },
                        }),
                        args.unitId
                            ? this.prisma.unit.findFirst({
                                where: {
                                    id: args.unitId,
                                    deletedAt: null,
                                    property: { companyId: context.companyId, deletedAt: null },
                                },
                            })
                            : Promise.resolve(null),
                    ]);

                    if (!property) return { error: 'Property not found for company.' };
                    if (!tenant) return { error: 'Tenant not found for company.' };
                    if (args.unitId && !unit) return { error: 'Unit not found for company.' };

                    return await this.prisma.lease.create({
                        data: {
                            tenantId: args.tenantId,
                            propertyId: args.propertyId,
                            unitId: args.unitId || null,
                            rentAmount: args.rentAmount,
                            deposit: args.deposit || null,
                            startDate: new Date(args.startDate),
                            endDate: new Date(args.endDate),
                            status: (typeof statusValue === 'string' ? statusValue : 'PENDING'),
                        },
                    });
                }

                case 'create_invoice': {
                    const confirmation = this.requireConfirmation(args, 'create_invoice', {
                        leaseId: args.leaseId,
                        amount: args.amount,
                        dueDate: args.dueDate,
                        description: args.description,
                        type: args.type,
                    });
                    if (confirmation) return confirmation;

                    const typeValue = validateEnum(args?.type, ALLOWED_INVOICE_TYPE, 'type');
                    if (typeValue && typeof typeValue === 'object') return typeValue;

                    await this.resolveCompanyId(context, args.leaseId, 'unit' as any); // resolving via Lease -> Property -> Company

                    const lease = await this.prisma.lease.findFirst({
                        where: {
                            id: args.leaseId,
                            deletedAt: null,
                            property: { companyId: context.companyId ?? undefined, deletedAt: null },
                        },
                    });
                    if (!lease) return { error: `Lease not found${context.companyId ? ' for company' : ''}.` };

                    return await this.prisma.invoice.create({
                        data: {
                            leaseId: args.leaseId,
                            amount: args.amount,
                            description: args.description,
                            type: (typeof typeValue === 'string' ? typeValue : 'RENT'),
                            dueDate: new Date(args.dueDate),
                            status: 'PENDING',
                        },
                    });
                }

                case 'record_payment': {
                    const confirmation = this.requireConfirmation(args, 'record_payment', {
                        leaseId: args.leaseId,
                        amount: args.amount,
                        method: args.method,
                        type: args.type,
                        reference: args.reference,
                        notes: args.notes,
                        paidAt: args.paidAt,
                    });
                    if (confirmation) return confirmation;

                    const methodValue = validateEnum(args?.method, ALLOWED_PAYMENT_METHOD, 'method');
                    if (methodValue && typeof methodValue === 'object') return methodValue;
                    const typeValue = validateEnum(args?.type, ALLOWED_PAYMENT_TYPE, 'type');
                    if (typeValue && typeof typeValue === 'object') return typeValue;

                    await this.resolveCompanyId(context, args.leaseId, 'unit' as any);

                    const lease = await this.prisma.lease.findFirst({
                        where: {
                            id: args.leaseId,
                            deletedAt: null,
                            property: { companyId: context.companyId ?? undefined, deletedAt: null },
                        },
                    });
                    if (!lease) return { error: `Lease not found${context.companyId ? ' for company' : ''}.` };

                    return await this.prisma.payment.create({
                        data: {
                            leaseId: args.leaseId,
                            amount: args.amount,
                            method: (typeof methodValue === 'string' ? methodValue : 'MPESA'),
                            type: (typeof typeValue === 'string' ? typeValue : 'RENT'),
                            reference: args.reference,
                            notes: args.notes,
                            paidAt: args.paidAt ? new Date(args.paidAt) : new Date(),
                        },
                    });
                }

                case 'create_maintenance_request': {
                    const confirmation = this.requireConfirmation(args, 'create_maintenance_request', {
                        propertyId: args.propertyId,
                        unitId: args.unitId,
                        tenantId: args.tenantId,
                        title: args.title,
                        description: args.description,
                        category: args.category,
                        priority: args.priority,
                    });
                    if (confirmation) return confirmation;

                    const priorityValue = validateEnum(args?.priority, ALLOWED_MAINTENANCE_PRIORITY, 'priority');
                    if (priorityValue && typeof priorityValue === 'object') return priorityValue;
                    const categoryValue = validateEnum(args?.category, ALLOWED_MAINTENANCE_CATEGORY, 'category');
                    if (categoryValue && typeof categoryValue === 'object') return categoryValue;

                    await this.resolveCompanyId(context, args.propertyId, 'property');
                    if (args.tenantId && !context.companyId) {
                        await this.resolveCompanyId(context, args.tenantId, 'tenant');
                    }

                    const [property, unit] = await Promise.all([
                        this.prisma.property.findFirst({
                            where: { id: args.propertyId, companyId: context.companyId ?? undefined, deletedAt: null },
                        }),
                        args.unitId
                            ? this.prisma.unit.findFirst({
                                where: {
                                    id: args.unitId,
                                    deletedAt: null,
                                    property: { companyId: context.companyId ?? undefined, deletedAt: null },
                                },
                            })
                            : Promise.resolve(null),
                    ]);

                    if (!property) return { error: `Property not found${context.companyId ? ' for company' : ''}.` };
                    if (args.unitId && !unit) return { error: `Unit not found${context.companyId ? ' for company' : ''}.` };

                    if (!context.companyId && property) {
                        context.companyId = property.companyId;
                    }

                    if (!context.companyId) return { error: 'Could not determine company context for this request.' };

                    return await this.prisma.maintenanceRequest.create({
                        data: {
                            companyId: context.companyId,
                            propertyId: args.propertyId,
                            unitId: args.unitId || null,
                            title: args.title,
                            description: args.description,
                            priority: (typeof priorityValue === 'string' ? priorityValue : 'MEDIUM'),
                            category: (typeof categoryValue === 'string' ? categoryValue : 'GENERAL'),
                        },
                    });
                }

                case 'update_unit_status': {
                    const confirmation = this.requireConfirmation(args, 'update_unit_status', {
                        unitId: args.unitId,
                        status: args.status,
                    });
                    if (confirmation) return confirmation;

                    const statusValue = validateEnum(args?.status, ALLOWED_UNIT_STATUS, 'status');
                    if (statusValue && typeof statusValue === 'object') return statusValue;
                    if (!statusValue) return { error: 'status is required.' };

                    await this.resolveCompanyId(context, args.unitId, 'unit');

                    const unit = await this.prisma.unit.findFirst({
                        where: {
                            id: args.unitId,
                            deletedAt: null,
                            property: { companyId: context.companyId ?? undefined, deletedAt: null },
                        },
                    });
                    if (!unit) return { error: `Unit not found${context.companyId ? ' for company' : ''}.` };

                    return await this.prisma.unit.update({
                        where: { id: args.unitId },
                        data: { status: statusValue },
                    });
                }

                case 'update_tenant': {
                    const confirmation = this.requireConfirmation(args, 'update_tenant', {
                        tenantId: args.tenantId,
                        firstName: args.firstName,
                        lastName: args.lastName,
                    });
                    if (confirmation) return confirmation;

                    await this.resolveCompanyId(context, args.tenantId, 'tenant');

                    if (args.propertyId) {
                        const property = await this.prisma.property.findFirst({
                            where: { id: args.propertyId, companyId: context.companyId, deletedAt: null },
                        });
                        if (!property) return { error: 'Property not found for company.' };
                    }

                    const data: any = {};
                    if (args.firstName !== undefined) data.firstName = args.firstName;
                    if (args.lastName !== undefined) data.lastName = args.lastName;
                    if (args.email !== undefined) data.email = args.email;
                    if (args.phone !== undefined) data.phone = args.phone;
                    if (args.idNumber !== undefined) data.idNumber = args.idNumber;
                    if (args.propertyId !== undefined) data.propertyId = args.propertyId;

                    if (Object.keys(data).length === 0) return { error: 'No fields provided to update.' };

                    return await this.prisma.tenant.update({
                        where: { id: args.tenantId },
                        data,
                    });
                }

                case 'update_property': {
                    const confirmation = this.requireConfirmation(args, 'update_property', {
                        propertyId: args.propertyId,
                        name: args.name,
                    });
                    if (confirmation) return confirmation;

                    await this.resolveCompanyId(context, args.propertyId, 'property');
                    const data: any = {};
                    if (args.name !== undefined) data.name = args.name;
                    if (args.address !== undefined) data.address = args.address;
                    if (args.propertyType !== undefined) data.propertyType = args.propertyType as any;
                    if (args.description !== undefined) data.description = args.description;
                    if (args.landlordId !== undefined) data.landlordId = args.landlordId;
                    if (args.commissionPercentage !== undefined) data.commissionPercentage = args.commissionPercentage;

                    if (Object.keys(data).length === 0) return { error: 'No fields provided to update.' };

                    return await this.prisma.property.update({
                        where: { id: args.propertyId, companyId: context.companyId ?? undefined },
                        data,
                    });
                }

                case 'update_landlord': {
                    const confirmation = this.requireConfirmation(args, 'update_landlord', {
                        landlordId: args.landlordId,
                        firstName: args.firstName,
                        lastName: args.lastName,
                    });
                    if (confirmation) return confirmation;

                    const data: any = {};
                    if (args.firstName !== undefined) data.firstName = args.firstName;
                    if (args.lastName !== undefined) data.lastName = args.lastName;
                    if (args.email !== undefined) data.email = args.email;
                    if (args.phone !== undefined) data.phone = args.phone;
                    if (args.idNumber !== undefined) data.idNumber = args.idNumber;
                    if (args.address !== undefined) data.address = args.address;

                    if (Object.keys(data).length === 0) return { error: 'No fields provided to update.' };

                    return await this.prisma.landlord.update({
                        where: { id: args.landlordId, companyId: context.companyId },
                        data,
                    });
                }

                case 'update_staff': {
                    const confirmation = this.requireConfirmation(args, 'update_staff', {
                        staffId: args.staffId,
                        firstName: args.firstName,
                        lastName: args.lastName,
                    });
                    if (confirmation) return confirmation;

                    const userToUpdate = await this.prisma.user.findUnique({
                        where: { id: args.staffId },
                    });

                    if (!userToUpdate) return { error: 'Staff member not found.' };

                    // SECURITY GUARD: AI cannot edit Company Admins
                    if (userToUpdate.role === UserRole.COMPANY_ADMIN) {
                        return { error: 'Security constraint: The AI is not permitted to modify accounts with the COMPANY_ADMIN role.' };
                    }

                    if (userToUpdate.companyId !== context.companyId && !context.isSuperAdmin) {
                        return { error: 'Access denied: You can only update staff members within your company.' };
                    }

                    const data: any = {};
                    if (args.firstName !== undefined) data.firstName = args.firstName;
                    if (args.lastName !== undefined) data.lastName = args.lastName;
                    if (args.email !== undefined) data.email = args.email;
                    if (args.phone !== undefined) data.phone = args.phone;
                    if (args.isActive !== undefined) data.isActive = args.isActive;

                    if (Object.keys(data).length === 0) return { error: 'No fields provided to update.' };

                    return await this.prisma.user.update({
                        where: { id: args.staffId },
                        data,
                        select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true, phone: true },
                    });
                }

                case 'update_lease': {
                    const confirmation = this.requireConfirmation(args, 'update_lease', {
                        leaseId: args.leaseId,
                        unitId: args.unitId,
                        rentAmount: args.rentAmount,
                        status: args.status,
                        startDate: args.startDate,
                        endDate: args.endDate,
                    });
                    if (confirmation) return confirmation;

                    const statusValue = validateEnum(args?.status, ALLOWED_LEASE_STATUS, 'status');
                    if (statusValue && typeof statusValue === 'object') return statusValue;

                    await this.resolveCompanyId(context, args.leaseId, 'unit' as any); // resolving via ID lookup is fine regardless of type string

                    const lease = await this.prisma.lease.findFirst({
                        where: {
                            id: args.leaseId,
                            deletedAt: null,
                            property: { companyId: context.companyId ?? undefined, deletedAt: null },
                        },
                    });
                    if (!lease) return { error: `Lease not found${context.companyId ? ' for company' : ''}.` };

                    if (args.unitId) {
                        const unit = await this.prisma.unit.findFirst({
                            where: {
                                id: args.unitId,
                                deletedAt: null,
                                property: { companyId: context.companyId ?? undefined, deletedAt: null },
                            },
                        });
                        if (!unit) return { error: `Unit not found${context.companyId ? ' for company' : ''}.` };
                    }

                    const data: any = {};
                    if (args.unitId !== undefined) data.unitId = args.unitId;
                    if (args.rentAmount !== undefined) data.rentAmount = args.rentAmount;
                    if (args.deposit !== undefined) data.deposit = args.deposit;
                    if (args.startDate !== undefined) data.startDate = new Date(args.startDate);
                    if (args.endDate !== undefined) data.endDate = new Date(args.endDate);
                    if (typeof statusValue === 'string') data.status = statusValue;

                    if (Object.keys(data).length === 0) return { error: 'No fields provided to update.' };

                    return await this.prisma.lease.update({
                        where: { id: args.leaseId },
                        data,
                    });
                }

                case 'update_invoice': {
                    const confirmation = this.requireConfirmation(args, 'update_invoice', {
                        invoiceId: args.invoiceId,
                        amount: args.amount,
                        dueDate: args.dueDate,
                        status: args.status,
                    });
                    if (confirmation) return confirmation;

                    const typeValue = validateEnum(args?.type, ALLOWED_INVOICE_TYPE, 'type');
                    if (typeValue && typeof typeValue === 'object') return typeValue;
                    const statusValue = validateEnum(args?.status, ALLOWED_INVOICE_STATUS, 'status');
                    if (statusValue && typeof statusValue === 'object') return statusValue;

                    const invoice = await this.prisma.invoice.findFirst({
                        where: {
                            id: args.invoiceId,
                            deletedAt: null,
                            lease: { property: { companyId: context.companyId, deletedAt: null } },
                        },
                    });
                    if (!invoice) return { error: 'Invoice not found for company.' };

                    const data: any = {};
                    if (args.amount !== undefined) data.amount = args.amount;
                    if (args.description !== undefined) data.description = args.description;
                    if (typeof typeValue === 'string') data.type = typeValue;
                    if (args.dueDate !== undefined) data.dueDate = new Date(args.dueDate);
                    if (typeof statusValue === 'string') data.status = statusValue;

                    if (Object.keys(data).length === 0) return { error: 'No fields provided to update.' };

                    return await this.prisma.invoice.update({
                        where: { id: args.invoiceId },
                        data,
                    });
                }

                case 'update_maintenance_request': {
                    const confirmation = this.requireConfirmation(args, 'update_maintenance_request', {
                        requestId: args.requestId,
                        status: args.status,
                        priority: args.priority,
                        assignedToId: args.assignedToId,
                    });
                    if (confirmation) return confirmation;

                    const statusValue = validateEnum(args?.status, ALLOWED_MAINTENANCE_STATUS, 'status');
                    if (statusValue && typeof statusValue === 'object') return statusValue;
                    const priorityValue = validateEnum(args?.priority, ALLOWED_MAINTENANCE_PRIORITY, 'priority');
                    if (priorityValue && typeof priorityValue === 'object') return priorityValue;
                    const categoryValue = validateEnum(args?.category, ALLOWED_MAINTENANCE_CATEGORY, 'category');
                    if (categoryValue && typeof categoryValue === 'object') return categoryValue;

                    const request = await this.prisma.maintenanceRequest.findFirst({
                        where: { id: args.requestId, companyId: context.companyId, deletedAt: null },
                    });
                    if (!request) return { error: 'Maintenance request not found for company.' };

                    const data: any = {};
                    if (typeof statusValue === 'string') data.status = statusValue;
                    if (typeof priorityValue === 'string') data.priority = priorityValue;
                    if (typeof categoryValue === 'string') data.category = categoryValue;
                    if (args.title !== undefined) data.title = args.title;
                    if (args.description !== undefined) data.description = args.description;
                    if (args.assignedToId !== undefined) data.assignedToId = args.assignedToId;
                    if (args.scheduledAt !== undefined) data.scheduledAt = new Date(args.scheduledAt);
                    if (args.completedAt !== undefined) data.completedAt = new Date(args.completedAt);
                    if (args.estimatedCost !== undefined) data.estimatedCost = args.estimatedCost;
                    if (args.actualCost !== undefined) data.actualCost = args.actualCost;
                    if (args.vendor !== undefined) data.vendor = args.vendor;
                    if (args.vendorPhone !== undefined) data.vendorPhone = args.vendorPhone;
                    if (args.notes !== undefined) data.notes = args.notes;

                    if (Object.keys(data).length === 0) return { error: 'No fields provided to update.' };

                    return await this.prisma.maintenanceRequest.update({
                        where: { id: args.requestId },
                        data,
                    });
                }

                case 'get_financial_report': {
                    const data = await this.getFinancialReportData(args, context);
                    return {
                        dateRange: { from: data.start.toISOString(), to: data.end.toISOString() },
                        groupBy: data.groupBy,
                        include: data.include,
                        totals: data.totals,
                        breakdown: data.breakdown,
                        ...(args?.explain
                            ? {
                                explain: {
                                    filters: {
                                        dateFrom: data.start.toISOString(),
                                        dateTo: data.end.toISOString(),
                                        companyId: context.companyId,
                                    },
                                    sourceLimits: { limit: data.limit },
                                    grouping: data.groupBy,
                                    included: data.include,
                                    notes: 'Breakdowns are computed from capped result sets.',
                                },
                            }
                            : {}),
                        capped: {
                            payments: { limit: data.limit, returned: data.payments.length },
                            expenses: { limit: data.limit, returned: data.expenses.length },
                            invoices: { limit: data.limit, returned: data.invoices.length },
                        },
                    };
                }

                case 'generate_report_file': {
                    const data = await this.getFinancialReportData(args, context);
                    const format = (args.format || 'pdf').toLowerCase();
                    const reportType = args.reportType || 'Financial';
                    const timestamp = Date.now();
                    const fileName = `${reportType.toLowerCase().replace(/\s+/g, '_')}_${timestamp}.${format}`;

                    if (format === 'csv') {
                        // Flatten data for CSV
                        const rows = [
                            ...data.payments.map(p => ({ type: 'PAYMENT', amount: p.amount, date: p.paidAt, property: p.lease?.property?.name })),
                            ...data.expenses.map(e => ({ type: 'EXPENSE', amount: e.amount, date: e.date, property: e.property?.name, category: e.category })),
                            ...data.invoices.map(i => ({ type: 'INVOICE', amount: i.amount, date: i.createdAt, property: i.lease?.property?.name, status: i.status })),
                        ];
                        const url = await this.reportsGenerator.generateCsv(rows, fileName);
                        return { message: `CSV report generated successfully.`, url };
                    } else {
                        const url = await this.reportsGenerator.generatePdf(data.breakdown, `${reportType} Report`, fileName);
                        return { message: `PDF report generated successfully.`, url };
                    }
                }

                case 'workflow_initiate':
                    if (!context.companyId && args.targetId) {
                        // Try to resolve companyId from targetId (Property or Tenant or MaintenanceRequest)
                        const [prop, tenant, mr] = await Promise.all([
                            this.prisma.property.findUnique({ where: { id: args.targetId }, select: { companyId: true } }),
                            this.prisma.tenant.findUnique({ where: { id: args.targetId }, select: { companyId: true } }),
                            this.prisma.maintenanceRequest.findUnique({ where: { id: args.targetId }, select: { companyId: true } }),
                        ]);
                        context.companyId = prop?.companyId || tenant?.companyId || mr?.companyId;
                    }

                    if (!context.companyId) return { error: 'Company context required for workflows.' };

                    return await this.prisma.workflowInstance.create({
                        data: {
                            type: args.type,
                            companyId: context.companyId,
                            targetId: args.targetId,
                            status: WorkflowStatus.ACTIVE,
                        },
                    });

                default:
                    return { error: `Tool ${name} not implemented` };
            }
        } catch (error) {
            this.logger.error(`Error executing tool ${name}: ${error.message}`);
            return { error: error.message };
        }
    }
}
