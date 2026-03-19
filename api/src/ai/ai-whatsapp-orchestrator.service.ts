import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../auth/roles.enum';
import { WhatsappService } from '../messaging/whatsapp.service';
import { AiService } from './ai.service';
import { tenantContext } from '../common/tenant-context';
import { detectLanguage, DetectedLanguage } from '../common/utils/language.util';
import { tryDirectTool } from './ai.direct';
import { AiClassifierService, ClassificationResult } from './ai-classifier.service';
import { NextStepOrchestrator } from './next-step-orchestrator.service';
import { ErrorRecoveryService } from './error-recovery.service';
import { MenuRouterService } from './menu-router.service';
import { MainMenuService } from './main-menu.service';
import { getSessionUid } from './ai-tool-selector.util';
import Groq, { toFile } from 'groq-sdk';

@Injectable()
export class AiWhatsappOrchestratorService {
    private readonly logger = new Logger(AiWhatsappOrchestratorService.name);
    private groq: Groq;

    constructor(
        private readonly prisma: PrismaService,
        private readonly whatsappService: WhatsappService,
        private readonly classifier: AiClassifierService,
        private readonly orchestrator: NextStepOrchestrator,
        private readonly recovery: ErrorRecoveryService,
        @Inject(forwardRef(() => AiService)) private readonly aiService: AiService,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
        private readonly menuRouter: MenuRouterService,
        private readonly mainMenu: MainMenuService,
    ) {
        this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }

    async handleIncomingWhatsapp(phone: string, text?: string, mediaId?: string, mimeType?: string, messageId?: string) {
        const uid = getSessionUid({ phone });
        const lockKey = `lock:wa:${uid}`;
        const isLocked = await this.cacheManager.get(lockKey);
        if (isLocked) {
            this.logger.warn(`Locked: Already processing a request for ${uid}`);
            return;
        }
        await this.cacheManager.set(lockKey, true, 60 * 1000); // 1 minute lock

        let sender: any = { id: 'unidentified', role: UserRole.UNIDENTIFIED };
        let language: string = 'en';

        try {
            sender = await this.whatsappService.identifySenderByPhone(phone);
            // Unified session UID (prefer userId if identified)
            const uid = getSessionUid({ userId: sender.id === 'unidentified' ? undefined : sender.id, phone });
            
            if (messageId && sender.role !== UserRole.UNIDENTIFIED) {
                await this.whatsappService.sendReaction({ to: phone, messageId, emoji: '⏳' });
            }

            const waProfile = await this.whatsappService.getWhatsAppProfile(phone);
            language = waProfile.language || 'en';

            if (!language || text) {
                const detected = detectLanguage(text || '');
                language = detected === DetectedLanguage.MIXED ? (language || 'sw') : (detected as any);
            }

            if (!waProfile.language && !text) {
                await this.whatsappService.sendInteractiveMessage({
                    to: phone,
                    interactive: {
                        type: 'button',
                        body: { text: "Welcome to Aedra! Please choose your preferred language / Karibu Aedra! Tafadhali chagua lugha unayopendelea:" },
                        action: {
                            buttons: [
                                { type: 'reply', reply: { id: 'lang_en', title: 'English' } },
                                { type: 'reply', reply: { id: 'lang_sw', title: 'Kiswahili' } }
                            ]
                        }
                    }
                });
                return;
            }

            if (!waProfile.language && (text === '1' || text === '2' || text === 'lang_en' || text === 'lang_sw')) {
                const selectedLang = (text === '1' || text === 'lang_en') ? 'en' : 'sw';
                await this.whatsappService.updateWhatsAppProfile(phone, { language: selectedLang });
                language = selectedLang;
            }

            // Handle "Home" or Greeting for identified users
            const isGreeting = (text && /^(hi|hello|start|home|menyu|menu|mwanzo)$/i.test(text.toLowerCase().trim()));
            if (isGreeting && sender.role !== UserRole.UNIDENTIFIED) {
                const menu = this.mainMenu.getMainMenu(language);
                await this.whatsappService.sendInteractiveMessage({ to: phone, interactive: menu });
                if (messageId) await this.whatsappService.sendReaction({ to: phone, messageId: messageId as string, emoji: '✅' });
                return { response: 'Showing Main Menu', chatId: null };
            }

            // Handle Unidentified user options
            if (sender.role === UserRole.UNIDENTIFIED) {
                if (text === 'auth_register') {
                    const resp = language === 'sw' ? 'Tafadhali andika jina la kampuni yako ili kuanza usajili.' : 'Please type your company name to begin registration.';
                    await this.whatsappService.sendTextMessage({ to: phone, text: resp });
                    return { response: resp, chatId: null };
                }
                if (text === 'auth_support') {
                    const resp = language === 'sw' ? 'Mhudumu wetu atawasiliana nawe hivi punde.' : 'One of our agents will contact you shortly.';
                    await this.whatsappService.sendTextMessage({ to: phone, text: resp });
                    return { response: resp, chatId: null };
                }
                // Show unidentified menu if they just say "hi"
                if (isGreeting) {
                    const menu = this.mainMenu.getUnidentifiedMenu(language);
                    await this.whatsappService.sendInteractiveMessage({ to: phone, interactive: menu });
                    return { response: 'Showing Unidentified Menu', chatId: null };
                }
            }

            const twoHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
            const lastChat = await this.prisma.chatHistory.findFirst({
                where: { 
                    userId: sender.id === 'unidentified' ? null : sender.id,
                    deletedAt: null,
                    updatedAt: { gte: twoHoursAgo }
                },
                orderBy: { updatedAt: 'desc' }
            });

            return await tenantContext.run({ 
                companyId: lastChat?.companyId || sender.companyId || undefined, 
                userId: sender.id,
                role: sender.role,
                isSuperAdmin: sender.role === UserRole.SUPER_ADMIN,
                chatId: lastChat?.id || undefined
            }, async () => {
                const companyId = lastChat?.companyId || sender.companyId || undefined;
                this.logger.log(`Processing WhatsApp from ${phone}: role=${sender.role}, id=${sender.id}, companyId=${companyId || 'NONE'}`);

                let downloadedMedia: { data: string; mimeType: string } | null = null;
                if (mimeType?.startsWith('audio') && mediaId) {
                    try {
                        downloadedMedia = await this.whatsappService.downloadMedia(mediaId, companyId);
                        const transcript = await this.transcribeAudio(downloadedMedia.data, downloadedMedia.mimeType, language || undefined);
                        if (!transcript || transcript.trim() === '') {
                            const failMsg = language === 'sw'
                                ? 'Samahani, sikuweza kusikia vizuri. Tafadhali rudia au andika ujumbe wako.'
                                : 'Sorry, I could not understand the voice note. Please try again or type your message.';
                            await this.whatsappService.sendTextMessage({ companyId, to: phone, text: failMsg });
                            return { response: failMsg, chatId: lastChat?.id || null };
                        }
                        text = transcript;
                        const detectedLang = detectLanguage(transcript || '');
                        if (detectedLang !== 'mixed') {
                            language = detectedLang as any;
                        }
                    } catch (e) {
                        this.logger.error(`Audio transcription failed: ${e.message}`);
                    }
                }

                const lang = language || 'en';


            // Resolve chatId early for logging
            let chatId = lastChat?.id;

            // Helper to send and log
            const sendAndLog = async (resp: string, cid?: string, interactive?: any) => {
                if (interactive) {
                    await this.whatsappService.sendInteractiveMessage({ 
                        companyId: cid || companyId, 
                        to: phone, 
                        interactive 
                    });
                } else {
                    await this.whatsappService.sendTextMessage({ 
                        companyId: cid || companyId, 
                        to: phone, 
                        text: resp 
                    });
                }

                if (chatId) {
                    await this.prisma.chatMessage.create({
                        data: { chatHistoryId: chatId, role: 'assistant', content: resp }
                    });
                }
            };

            const listKey = `list:${uid}`;
            let activeList: any = await this.cacheManager.get(listKey);
            if (!activeList) {
                const sessionRaw = await this.cacheManager.get<any>(`ai_session:${uid}`);
                if (sessionRaw) {
                    const session = typeof sessionRaw === 'string' ? JSON.parse(sessionRaw) : sessionRaw;
                    // Support reconstruction if we have results, even if awaitingSelection isn't set (fallback)
                    if (session.lastResults && (session.awaitingSelection || session.lastIntent?.startsWith('list_'))) {
                        activeList = { items: session.lastResults, chatId: lastChat?.id };
                        await this.cacheManager.set(listKey, activeList, 300 * 1000); // 5 minutes
                    }
                }
            }

            const safeText = text?.trim() || '';
            const isNumericSelection = safeText && /^\d+[\.\?\!\s]*$/.test(safeText);
            const isUuidSelection = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(safeText);
            
            this.logger.debug(`Priority 0 Check: activeList=${!!activeList}, isNumericSelection=${isNumericSelection}, isUuidSelection=${isUuidSelection}, text="${safeText}"`);

            // Handle UUID selection (from List Message)
            if (isUuidSelection) {
                const ctx = {
                    userRole: sender.role,
                    role: sender.role,
                    isSuperAdmin: sender.role === UserRole.SUPER_ADMIN,
                    companyId,
                    userId: sender.id,
                    phone,
                    chatId: chatId || lastChat?.id
                };
                
                // Check if it's a company ID
                const company = await this.prisma.company.findUnique({ where: { id: safeText } });
                if (company) {
                    await this.cacheManager.del(listKey);
                    const actionResult = await this.aiService.executeTool('select_company', { companyId: safeText }, ctx, lang);
                    const formatted = await this.aiService.formatToolResponse(actionResult, sender, safeText, lang);
                    await sendAndLog(formatted.text, undefined, formatted.interactive);
                    if (messageId) await this.whatsappService.sendReaction({ to: phone, messageId, emoji: '✅' });
                    return { response: formatted.text, chatId: ctx.chatId || null };
                }
            }

            if (activeList && isNumericSelection) {
                const index = parseInt(safeText.replace(/\D/g, ''), 10) - 1;


                const selected = activeList.items?.[index];
                this.logger.debug(`Priority 1 Match: index=${index}, selected=${selected?.name}`);
                if (selected) {
                    await this.cacheManager.del(listKey);
                    const ctx = {
                        userRole: sender.role,
                        role: sender.role,
                        isSuperAdmin: sender.role === UserRole.SUPER_ADMIN,
                        companyId,
                        userId: sender.id,
                        phone,
                        chatId: activeList.chatId || chatId
                    };
                    const actionResult = await this.aiService.executeTool('select_company', { companyId: selected.id }, ctx, lang);
                    const formatted = await this.aiService.formatToolResponse(actionResult, sender, selected.id, lang);
                    
                    await sendAndLog(formatted.text, undefined, formatted.interactive);
                    if (messageId) await this.whatsappService.sendReaction({ to: phone, messageId, emoji: '✅' });
                    return { response: formatted.text, chatId: activeList.chatId || chatId || null };
                }
            }

            // Priority 1.5 - Check for orchestrated options (pendingConfirmation)
            if (isNumericSelection) {
                const session = await this.cacheManager.get<any>(`ai_session:${uid}`);
                if (session && session.pendingConfirmation && session.pendingConfirmation.options) {
                    const optionKey = safeText.replace(/\D/g, '');
                    const orchestratedAction = session.pendingConfirmation.options[optionKey];
                    if (orchestratedAction) {
                        this.logger.log(`Handling orchestrated selection: ${orchestratedAction}`);
                        // Clear pending confirmation
                        delete session.pendingConfirmation;
                        await this.cacheManager.set(`ai_session:${uid}`, session, 3600 * 1000);

                        if (orchestratedAction === 'execute_plan') {
                            const result = await this.aiService.executePlan(sender.id, phone);
                            await sendAndLog(result.response);
                            return result;
                        }

                        if (orchestratedAction === 'cancel_plan') {
                             const cancelMsg = lang === 'sw' ? 'Sawa, mpango umefutwa.' : 'Got it, plan cancelled.';
                             await sendAndLog(cancelMsg);
                             return { response: cancelMsg, chatId: chatId || null };
                        }

                        const actionResult = await this.aiService.executeTool(orchestratedAction, {}, {
                            userRole: sender.role,
                            role: sender.role,
                            isSuperAdmin: sender.role === UserRole.SUPER_ADMIN,
                            companyId,
                            userId: sender.id,
                            phone,
                            chatId: chatId,
                        }, lang);
                        
                        const formatted = await this.aiService.formatToolResponse(actionResult, sender, companyId || '', lang);
                        await sendAndLog(formatted.text, undefined, formatted.interactive);
                        if (messageId) await this.whatsappService.sendReaction({ to: phone, messageId, emoji: '✅' });
                        return { response: formatted.text, chatId: chatId || null };
                    }
                }
            }


            // Cleanup stale lists and session state if user sends non-numeric text
            if (!isNumericSelection && !safeText.startsWith('/')) {
                this.logger.debug(`Cleaning up stale selection state for ${uid}`);
                await this.cacheManager.del(listKey);
                const session = await this.cacheManager.get<any>(`ai_session:${uid}`);
                if (session && session.awaitingSelection) {
                    delete session.awaitingSelection;
                    await this.cacheManager.set(`ai_session:${uid}`, session, 3600 * 1000);
                }
            }





            // Priority 2 — menu router (if no active list match or not a digit)
            const menuRoute = await this.menuRouter.routeMessage(uid, text, lang);
            if (menuRoute.handled) {
                if (menuRoute.tool) {
                    const actionResult = await this.aiService.executeTool(menuRoute.tool.name, menuRoute.tool.args || {}, {
                        userRole: sender.role,
                        role: sender.role,
                        isSuperAdmin: sender.role === UserRole.SUPER_ADMIN,
                        companyId,
                        userId: sender.id,
                        phone,
                        chatId: chatId,
                    }, lang);
                    const targetCompanyId = menuRoute.tool.args?.companyId || companyId || '';
                    const formatted = await this.aiService.formatToolResponse(actionResult, sender, targetCompanyId, lang);
                    let finalResponse = formatted.text;
                    if (menuRoute.response) {
                        finalResponse = `${menuRoute.response}\n\n${finalResponse}`;
                    }
                    await sendAndLog(finalResponse, undefined, formatted.interactive);
                    if (messageId) await this.whatsappService.sendReaction({ to: phone, messageId, emoji: '✅' });
                    return { response: finalResponse, chatId: chatId || null };
                }
                if (menuRoute.response) {
                    await sendAndLog(menuRoute.response);
                    return { response: menuRoute.response, chatId: chatId || null };
                }
            }


            if (text?.trim().toLowerCase() === '/reset') {
                if (lastChat?.id) {
                    await this.aiService.deleteChatSession(lastChat.id);
                }
                const resetMsg = language === 'sw' 
                    ? "🔄 Muktadha wa mazungumzo umewekwa upya. Naweza kukusaidia vipi leo?"
                    : "🔄 Chat context has been reset. How can I help you today?";
                await sendAndLog(resetMsg);
                return { response: resetMsg, chatId: null };
            }


            const lowered = text?.trim().toLowerCase() || '';
            const fastTextTools: Record<string, { name: string; args?: any }> = {
                'list companies': { name: 'list_companies' },
                'show companies': { name: 'list_companies' },
                'companies': { name: 'list_companies' },
            };
            if (fastTextTools[lowered]) {
                const tool = fastTextTools[lowered];
                const lang = language || 'en';
                const actionResult = await this.aiService.executeTool(tool.name, tool.args || {}, {
                    userRole: sender.role,
                    role: sender.role,
                    isSuperAdmin: sender.role === UserRole.SUPER_ADMIN,
                    companyId,
                    userId: sender.id,
                    phone,
                }, lang);
                
                const formatted = await this.aiService.formatToolResponse(actionResult, sender, companyId || '', lang);
                await sendAndLog(formatted.text, undefined, formatted.interactive);
                if (messageId) await this.whatsappService.sendReaction({ to: phone, messageId, emoji: '✅' });
                return { response: formatted.text, chatId: chatId || null };
            }


            const quickContext = {
                userId: sender.id,
                role: sender.role,
                companyId: companyId,
                userName: (waProfile as any)?.name || (waProfile as any)?.displayName || 'there',
                phone,
            } as any;

            if (text) {
                const lang = language || 'en';
                const directResponse = await tryDirectTool(text, quickContext, this.prisma, this.aiService.executeTool.bind(this.aiService), language || 'en', this.cacheManager);

                if (directResponse) {
                    if (!chatId) {
                        const chatHistory = await this.prisma.chatHistory.create({
                            data: {
                                ...(sender.id !== 'unidentified' ? { userId: sender.id } : {}),
                                companyId: companyId as any,
                                title: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
                            }
                        });
                        chatId = chatHistory.id;
                    }

                    await this.prisma.chatMessage.create({ data: { chatHistoryId: chatId, role: 'user', content: text } });

                    const actionResult = typeof directResponse === 'string'
                        ? { success: true, data: directResponse, action: 'direct' }
                        : directResponse;

                    const formatted = await this.aiService.formatToolResponse(actionResult, sender, companyId || '', lang);
                    await sendAndLog(formatted.text, undefined, formatted.interactive || (actionResult as any).interactive);
                    if (messageId) await this.whatsappService.sendReaction({ to: phone, messageId, emoji: '✅' });
                    return { response: formatted.text, chatId };
                }
            }



            let attachments: any[] = [];
            if (mediaId && mimeType) {
                try {
                    const media = downloadedMedia || await this.whatsappService.downloadMedia(mediaId, companyId);
                    attachments.push(media);
                } catch (e) {
                    this.logger.error(`Failed to download WhatsApp media: ${e.message}`);
                }
            }

            const effectiveText = text || (mediaId ? "[Attachment]" : "");


            let classification: ClassificationResult;
            try {
                classification = await Promise.race([
                    this.classifier.classify(effectiveText, (sender.role as any)),
                    new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Classification timeout')), 10000))
                ]);
            } catch (err: any) {
                classification = { intent: 'unknown', complexity: 2, executionMode: 'LIGHT_COMPOSE', language: 'en', reason: 'Timeout fallback' };
            }
            
            if (classification.language !== 'mixed' && classification.language !== language) {
                language = classification.language;
            }

            if (classification.complexity >= 4 || classification.executionMode === 'INTELLIGENCE') {
                const holdingMsg = language === 'sw' 
                    ? "Ninaandaa ripoti yako kamili... hii inachukua sekunde 20."
                    : "Generating your full portfolio report... this takes about 20 seconds.";
                await sendAndLog(holdingMsg);
            }


            let history: any[] = [];
            if (lastChat?.id) {
                const messages = await this.aiService.getChatHistory(lastChat.id);
                // Map to Gemini history format (role: 'user' | 'model', parts: [{ text }])
                history = messages.slice(-15).map(m => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content }]
                }));

                // Gemini validation: First message MUST be 'user'
                while (history.length > 0 && history[0].role !== 'user') {
                    history.shift();
                }
            }


            const result = await this.aiService.chat(history, effectiveText, lastChat?.id, companyId, undefined, attachments, language || undefined, classification, phone);

            
            if (result.response) {
                let finalResponse = this.stripJsonBlocks(result.response);
                if (finalResponse.length > 800 || (finalResponse.length > 300 && finalResponse.includes('\n\n\n'))) {
                    finalResponse = await this.summarizeForWhatsApp(finalResponse, language ?? undefined);
                }

                // CHECK IF WE SHOULD SEND A LIST MESSAGE (if we don't already have interactive buttons from result)
                if (!result.interactive) {
                    const listKey = `list:${uid}`;
                    const justCachedList: any = await this.cacheManager.get(listKey);
                    if (justCachedList && justCachedList.items && justCachedList.items.length > 0) {
                        const items = justCachedList.items.slice(0, 10);
                        result.interactive = {
                            type: 'list',
                            header: { type: 'text', text: 'Selection Required' },
                            body: { text: finalResponse.slice(0, 1024) },
                            action: {
                                button: 'Select Option',
                                sections: [
                                    {
                                        title: 'Results',
                                        rows: items.map((item: any) => ({
                                            id: item.id,
                                            title: item.name.slice(0, 24),
                                            description: item.type
                                        }))
                                    }
                                ]
                            }
                        };
                    }
                }

                await sendAndLog(finalResponse, undefined, result.interactive);
                result.response = finalResponse;
            }


            if ('generatedFiles' in result && result.generatedFiles && result.generatedFiles.length > 0) {
                const docTemplate = process.env.WA_REPORT_TEMPLATE;
                for (const file of result.generatedFiles) {
                    try {
                        if (docTemplate) {
                            await this.whatsappService.sendDocumentTemplate({
                                companyId, to: phone, templateName: docTemplate, url: file.url, fileName: file.fileName,
                            });
                        } else {
                            await this.whatsappService.sendDocument({
                                companyId, to: phone, url: file.url, fileName: file.fileName, caption: `Strategic ${file.fileName.split('_')[0] || 'Report'}`
                            });
                        }
                    } catch (e) {
                        this.logger.error(`Failed to push document to WhatsApp: ${e.message}`);
                    }
                }
            }
            
            if (messageId) {
                await this.whatsappService.sendReaction({ to: phone, messageId: messageId as string, emoji: '✅' });
            }
            return result;
        });
    } catch (err: any) {
            this.logger.error(`Orchestrator loop failed: ${err.message}`, err.stack);
            const userId = (typeof sender !== 'undefined' && sender) ? sender.id : 'unidentified';
            const recoveryMsg = this.recovery.buildErrorRecovery('default', err, { userId }, (language as any) || 'en');
            await this.whatsappService.sendTextMessage({ to: phone, text: recoveryMsg });
            if (messageId) {
                await this.whatsappService.sendReaction({ to: phone, messageId: messageId as string, emoji: '❌' });
            }
            return { response: recoveryMsg, chatId: null };
        } finally {
            await this.cacheManager.del(lockKey);
        }
    }

    private async transcribeAudio(base64: string, mimeType: string, language?: string): Promise<string | null> {
        const buffer = Buffer.from(base64, 'base64');
        try {
            const response: any = await this.groq.audio.transcriptions.create({
                file: await toFile(buffer, `audio.${mimeType?.split('/')?.[1] || 'ogg'}`, { type: mimeType || 'audio/ogg' }),
                model: 'whisper-large-v3',
                response_format: 'text',
                language: language === 'sw' ? 'sw' : undefined,
            });
            const transcript = typeof response === 'string' ? response : response?.text;
            if (transcript) return transcript.trim();
        } catch (error) {
            this.logger.warn(`Groq Whisper transcription failed: ${error.message}`);
        }
        return null;
    }

    private stripJsonBlocks(text: string): string {
        if (!text) return text;
        let cleaned = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, '');
        cleaned = cleaned.replace(/\{(\s*"[^"]+"\s*:\s*(?:[^"{}[\]]+|{[^{}]*}|\[[^[\]]*\]),?)*\}/g, (match) => {
            try {
                if (match.length > 20 && match.includes('"') && match.includes(':')) {
                    JSON.parse(match);
                    return '';
                }
                return match;
            } catch (e) {
                return match; 
            }
        });
        cleaned = cleaned.replace(/\bjson\b\s*/gim, '');
        return cleaned.trim();
    }

    private async summarizeForWhatsApp(text: string, language: string = 'en'): Promise<string> {
        try {
            return await this.aiService.summarizeForWhatsApp(text, language);
        } catch (e) {
            return text;
        }
    }
}
