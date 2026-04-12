import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../auth/roles.enum';
import { WhatsappService } from '../messaging/whatsapp.service';
import { AiService } from './ai.service';
import { tenantContext } from '../common/tenant-context';
import {
  detectLanguage,
  DetectedLanguage,
} from '../common/utils/language.util';
import { tryDirectTool } from './ai.direct';
import {
  AiClassifierService,
  ClassificationResult,
} from './ai-classifier.service';
import { NextStepOrchestrator } from './next-step-orchestrator.service';
import { ErrorRecoveryService } from './error-recovery.service';
import { MenuRouterService } from './menu-router.service';
import { AuthorizationStatus } from '@prisma/client';
import { MainMenuService } from './main-menu.service';
import { WhatsAppFormatterService } from './whatsapp-formatter.service';
import { getSessionUid } from './ai-tool-selector.util';
import { QuorumBridgeService } from './quorum-bridge.service';
import { AiStagingService } from './ai-staging.service';
import { WaCrudButtonsService } from './wa-crud-buttons.service';
import { WorkflowEngine } from '../workflows/workflow.engine';
import Groq, { toFile } from 'groq-sdk';
import { AiServiceChatResponse } from './ai-contracts.types';
import { ContextMemoryService } from './context-memory.service';

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
    private readonly aiService: AiService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly menuRouter: MenuRouterService,
    private readonly mainMenu: MainMenuService,
    private readonly whatsappFormatter: WhatsAppFormatterService,
    private readonly quorumBridge: QuorumBridgeService,
    private readonly staging: AiStagingService,
    private readonly crudButtons: WaCrudButtonsService,
    private readonly workflowEngine: WorkflowEngine,
    private readonly contextMemory: ContextMemoryService,
  ) {
    const apiKey = process.env.GROQ_API_KEY;
    this.groq = apiKey ? new Groq({ apiKey }) : (null as any);
  }


  async handleIncomingWhatsapp(
    phone: string,
    text?: string,
    mediaId?: string,
    mimeType?: string,
    messageId?: string,
  ): Promise<any> {
    const initialUid = getSessionUid({ phone });
    const lockKey = `lock:wa:${initialUid}`;
    const msgLockKey = messageId ? `lock:msg:${messageId}` : null;

    const [isProcessing, isDuplicate] = await Promise.all([
      this.cacheManager.get(lockKey),
      msgLockKey ? this.cacheManager.get(msgLockKey) : Promise.resolve(false),
    ]);

    this.logger.log(
      `[WhatsApp] Incoming from ${phone} (wamid: ${messageId || 'NONE'}). Lock: ${!!isProcessing}, Duplicate: ${!!isDuplicate}`,
    );

    if (isDuplicate) {
      this.logger.warn(`Duplicate: Message ${messageId} already processed/processing.`);
      return;
    }

    if (isProcessing) {
      this.logger.warn(`Locked: Already processing a request for ${initialUid}`);
      return;
    }

    await Promise.all([
      this.cacheManager.set(lockKey, true, 60 * 1000),
      msgLockKey ? this.cacheManager.set(msgLockKey, true, 300 * 1000) : Promise.resolve(),
    ]);

    let sender: any = { id: 'unidentified', role: UserRole.UNIDENTIFIED };
    let language: string = 'en';

    let chatId: string | null = null;
    try {
      sender = await this.whatsappService.identifySenderByPhone(phone);
      // Unified session UID (finalized after identification)
      const uid = getSessionUid({
        userId: sender.id === 'unidentified' ? undefined : sender.id,
        phone,
      });

      if (messageId && sender.role !== UserRole.UNIDENTIFIED) {
        await this.whatsappService.sendReaction({
          to: phone,
          messageId,
          emoji: '⏳',
        });
      }

      const waProfile = await this.whatsappService.getWhatsAppProfile(phone);
      language = waProfile.language || 'en';

      if (!language || text) {
        const detected = detectLanguage(text || '');
        language =
          detected === DetectedLanguage.MIXED
            ? language || 'sw'
            : (detected as any);
      }

      if (!waProfile.language && !text) {
        await this.whatsappService.sendInteractiveMessage({
          to: phone,
          interactive: {
            type: 'button',
            body: {
              text: 'Welcome to Aedra! Please choose your preferred language / Karibu Aedra! Tafadhali chagua lugha unayopendelea:',
            },
            action: {
              buttons: [
                { type: 'reply', reply: { id: 'lang_en', title: 'English' } },
                { type: 'reply', reply: { id: 'lang_sw', title: 'Kiswahili' } },
              ],
            },
          },
        });
        return;
      }

      if (
        !waProfile.language &&
        (text === '1' ||
          text === '2' ||
          text === 'lang_en' ||
          text === 'lang_sw')
  ) {
        const selectedLang = text === '1' || text === 'lang_en' ? 'en' : 'sw';
        await this.whatsappService.updateWhatsAppProfile(phone, {
          language: selectedLang,
        });
        language = selectedLang;
      }

      // Handle "Home" or Greeting for identified users
      const isGreeting =
        text &&
        /^(hi|hello|start|home|menyu|menu|mwanzo)$/i.test(
          text.toLowerCase().trim(),
        );
      if (isGreeting && sender.role !== UserRole.UNIDENTIFIED) {
        const context = await this.getMenuContext(sender, language);
        const menu = this.mainMenu.getMainMenu(sender.role, language, context);
        await this.whatsappService.sendInteractiveMessage({
          to: phone,
          interactive: menu,
        });
        if (messageId)
          await this.whatsappService.sendReaction({
            to: phone,
            messageId: messageId,
            emoji: '✅',
          });
        chatId = await this.aiService.getOrCreateChat(sender.id, sender.companyId, phone);
        await this.prisma.chatMessage.create({
          data: {
            chatHistoryId: chatId,
            role: 'assistant',
            content: 'Showing Main Menu',
          },
        });
        return { response: 'Showing Main Menu', chatId };
      }

      // Handle Unidentified user options
      if (sender.role === UserRole.UNIDENTIFIED) {
        if (text === 'auth_register') {
          const resp =
            language === 'sw'
              ? 'Tafadhali andika jina la kampuni yako ili kuanza usajili.'
              : 'Please type your company name to begin registration.';
          
          chatId = await this.aiService.getOrCreateChat('unidentified', undefined, phone);
          await this.prisma.chatMessage.create({
            data: { chatHistoryId: chatId, role: 'assistant', content: resp },
          });

          await this.whatsappService.sendTextMessage({ to: phone, text: resp });
          return { response: resp, chatId };
        }
        if (text === 'auth_support') {
          const resp =
            language === 'sw'
              ? 'Mhudumu wetu atawasiliana nawe hivi punde.'
              : 'One of our agents will contact you shortly.';

          chatId = await this.aiService.getOrCreateChat('unidentified', undefined, phone);
          await this.prisma.chatMessage.create({
            data: { chatHistoryId: chatId, role: 'assistant', content: resp },
          });

          await this.whatsappService.sendTextMessage({ to: phone, text: resp });
          return { response: resp, chatId };
        }
        // Show unidentified menu if they just say "hi"
        if (isGreeting) {
          const menu = this.mainMenu.getUnidentifiedMenu(language);
          chatId = await this.aiService.getOrCreateChat('unidentified', undefined, phone);
          await this.prisma.chatMessage.create({
            data: {
              chatHistoryId: chatId,
              role: 'assistant',
              content: 'Welcome to Aedra! Would you like to register a new company or talk to support?',
            },
          });
          await this.whatsappService.sendInteractiveMessage({
            to: phone,
            interactive: menu,
          });
          return { response: 'Showing Unidentified Menu', chatId };
        }
      }

      const isUnidentified = sender.id === 'unidentified';
      const twoHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
      const lastChat = await this.prisma.chatHistory.findFirst({
        where: {
          userId: isUnidentified ? null : sender.id,
          waPhone: isUnidentified ? phone : undefined,
          deletedAt: null,
          updatedAt: { gte: twoHoursAgo },
        },
        orderBy: { updatedAt: 'desc' },
      });
      chatId = lastChat?.id || null;

      return await tenantContext.run(
        {
          companyId: lastChat?.companyId || sender.companyId || undefined,
          userId: sender.id,
          role: sender.role,
          isSuperAdmin: sender.role === UserRole.SUPER_ADMIN,
          chatId: chatId || undefined,
        },
        async (): Promise<any> => {
          const companyId =
            lastChat?.companyId || sender.companyId || undefined;
          this.logger.log(
            `Processing WhatsApp from ${phone}: role=${sender.role}, id=${sender.id}, companyId=${companyId || 'NONE'}`,
          );

          const lang = language || 'en';
          let downloadedMedia: { data: string; mimeType: string } | null = null;
          if (mimeType?.startsWith('audio') && mediaId) {
            // Proactive feedback for audio (sent even if download/transcription fails)
            const feedbackMsg =
              lang === 'sw'
                ? '🎤 Nimepokea ujumbe wako wa sauti. Hebu niusikilize...'
                : '🎤 Received your voice note. Let me listen to it...';
            await this.whatsappService.sendTextMessage({
              companyId,
              to: phone,
              text: feedbackMsg,
            });

            try {
              downloadedMedia = await this.whatsappService.downloadMedia(
                mediaId,
                companyId,
              );
            } catch (e: any) {
              const msg = (e?.message || '').toLowerCase();
              const isNetworkError =
                msg.includes('fetch failed') ||
                msg.includes('timeout') ||
                msg.includes('econnrefused') ||
                msg.includes('network');
              this.logger.error(
                `WhatsApp audio download failed: ${e?.message || e}${isNetworkError ? ' (network)' : ''}`,
              );
              const failMsg =
                lang === 'sw'
                  ? 'Samahani — sikuweza kupakua voice note yako. Tafadhali jaribu kuituma tena au andika ujumbe wako.'
                  : "Sorry — I couldn't download your voice note. Please resend it or type your message.";
              await this.whatsappService.sendTextMessage({
                companyId,
                to: phone,
                text: failMsg,
              });
              return { response: failMsg, chatId: lastChat?.id || null };
            }

            let transcript: string | null = null;
            try {
              transcript = await this.transcribeAudio(
                downloadedMedia.data,
                downloadedMedia.mimeType,
                language || undefined,
              );
            } catch (e: any) {
              const msg = (e?.message || '').toLowerCase();
              const isNetworkError =
                msg.includes('fetch failed') ||
                msg.includes('timeout') ||
                msg.includes('econnrefused') ||
                msg.includes('network');
              this.logger.error(
                `Audio transcription failed: ${e?.message || e}${isNetworkError ? ' (network)' : ''}`,
              );
              const failMsg =
                lang === 'sw'
                  ? 'Samahani — sikuweza kusikiliza voice note yako sasa hivi. Tafadhali jaribu tena au andika ujumbe wako.'
                  : "Sorry — I couldn't process your voice note right now. Please try again or type your message.";
              await this.whatsappService.sendTextMessage({
                companyId,
                to: phone,
                text: failMsg,
              });
              return { response: failMsg, chatId: lastChat?.id || null };
            }

            if (!transcript || transcript.trim() === '') {
              const failMsg =
                lang === 'sw'
                  ? 'Samahani, sikuweza kusikia vizuri. Tafadhali rudia au andika ujumbe wako.'
                  : 'Sorry, I could not understand the voice note. Please try again or type your message.';
              await this.whatsappService.sendTextMessage({
                companyId,
                to: phone,
                text: failMsg,
              });
              return { response: failMsg, chatId: lastChat?.id || null };
            }

            // Echo back what was heard so the user can verify before the AI acts on it
            const echoMsg =
              lang === 'sw'
                ? `✍️ Nilisikia: _"${transcript}"_`
                : `✍️ I heard: _"${transcript}"_`;
            await this.whatsappService.sendTextMessage({
              companyId,
              to: phone,
              text: echoMsg,
            });

            text = transcript;
            const detectedLang = detectLanguage(transcript || '');
            if (detectedLang !== 'mixed') {
              language = detectedLang as any;
            }

          }

          // Resolve chatId early for logging
          chatId = lastChat?.id || chatId;

          // Helper to send and log
          const sendAndLog = async (
            resp: string,
            cid?: string,
            interactive?: any,
            skipLog: boolean = false,
          ) => {
            if (interactive) {
              await this.whatsappService.sendInteractiveMessage({
                companyId: cid || companyId,
                to: phone,
                interactive,
              });
            } else {
              await this.whatsappService.sendTextMessage({
                companyId: cid || companyId,
                to: phone,
                text: resp,
              });
            }

            if (chatId && !skipLog) {
              await this.prisma.chatMessage.create({
                data: {
                  chatHistoryId: chatId,
                  role: 'assistant',
                  content: resp,
                },
              });
            }
          };

          const listKey = `list:${uid}`;
          let activeList: any = await this.cacheManager.get(listKey);
          if (!activeList) {
            const sessionRaw = await this.cacheManager.get<any>(
              `ai_session:${uid}`,
            );
            if (sessionRaw) {
              const session =
                typeof sessionRaw === 'string'
                  ? JSON.parse(sessionRaw)
                  : sessionRaw;
              if (
                session.lastResults &&
                (session.awaitingSelection ||
                  session.lastIntent?.startsWith('list_'))
              ) {
                activeList = {
                  items: session.lastResults,
                  chatId: lastChat?.id,
                };
                await this.cacheManager.set(listKey, activeList, 300 * 1000); // 5 minutes
              }
            }
          }

          const recoveryKey = `recovery:${uid}`;
          const activeRecovery: any = await this.cacheManager.get(recoveryKey);

          let safeText = text?.trim() || '';
          const isNumericSelection =
            safeText && /^\d+[\.\?\!\s]*$/.test(safeText);
          const isUuidSelection =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              safeText,
            );

          let isListSelection = false;
          let listSelectionType = '';

          // INTERCEPT RAW UUID SELECTIONS FROM LIST MENUS
          // If a user clicks a WhatsApp List Menu item, it sends the raw record ID (UUID).
          // We must map it back to semantic text so the LLM classifier understands the context,
          // rather than hallucinating that a raw UUID means a highly complex Portfolio Report request.
          if (isUuidSelection && activeList?.items) {
            const matchedItem = activeList.items.find((i: any) => i.id === safeText);
            if (matchedItem) {
              isListSelection = true;
              const matchedType = (matchedItem.type || '').toString().toLowerCase().trim();
              listSelectionType =
                matchedType === 'tenant' || matchedItem.role === 'TENANT'
                  ? 'tenant'
                  : matchedType === 'property' || matchedItem.address
                    ? 'property'
                    : matchedType === 'unit' || matchedItem.unitNumber
                      ? 'unit'
                      : 'item';
              const itemName =
                matchedItem.name || matchedItem.firstName || matchedItem.title || safeText;

              // Persist selection into ContextMemory so follow-ups like "this property" resolve.
              try {
                if (listSelectionType === 'property') {
                  await this.contextMemory.stitch(uid, [
                    { type: 'property', id: matchedItem.id, name: itemName },
                  ]);
                } else if (listSelectionType === 'tenant') {
                  await this.contextMemory.stitch(uid, [
                    { type: 'tenant', id: matchedItem.id, name: itemName },
                  ]);
                } else if (listSelectionType === 'unit') {
                  await this.contextMemory.stitch(uid, [
                    { type: 'unit', id: matchedItem.id, name: itemName },
                  ]);
                }
              } catch (e: any) {
                this.logger.warn(
                  `[WhatsApp Orchestrator] Failed to persist selection context: ${e?.message || e}`,
                );
              }

              // Consume the selection list so it doesn't keep re-triggering selection UI.
              await this.cacheManager.del(listKey);
              const sessionKey = `ai_session:${uid}`;
              const session = await this.cacheManager.get<any>(sessionKey);
              if (session && session.awaitingSelection) {
                delete session.awaitingSelection;
                await this.cacheManager.set(sessionKey, session, 3600 * 1000);
              }

              // Rewrite the original text payload so the rest of the orchestrator sees semantic text
              text = `Select this item: ${itemName} (ID: ${safeText})`;
              safeText = text.trim();
              this.logger.log(`[WhatsApp Orchestrator] Intercepted list selection UUID ${safeText}, mapped to semantic text.`);
            }
          }

          // BUTTON REPLY HANDLING (INTERACTIVE)
          // Handle Autonomous Agent Workflow Resumption/Approval
          const waitingInstanceId = await this.cacheManager.get(
            `agent_notes_wait:${uid}`,
          );
          if (waitingInstanceId && text && !safeText.startsWith('WF_')) {
            await this.cacheManager.del(`agent_notes_wait:${uid}`);
            if (messageId)
              await this.whatsappService.sendReaction({
                to: phone,
                messageId,
                emoji: '📝',
              });
            await this.workflowEngine.resume(waitingInstanceId as string, {
              type: 'INPUT',
              content: text,
            });
            return { response: 'Notes received' };
          }

          if (safeText.startsWith('WF_RESUME_')) {
            const parts = safeText.split('_');
            const instanceId = parts[2];
            const action = parts[3];

            if (action === 'APPROVE') {
              if (messageId)
                await this.whatsappService.sendReaction({
                  to: phone,
                  messageId,
                  emoji: '⏩',
                });

              await this.workflowEngine.resume(instanceId, {
                type: 'INPUT',
                content: 'approved',
              });
              const approveMsg =
                lang === 'sw'
                  ? '✅ Mpango umeidhinishwa. Naanza sasa...'
                  : '✅ Plan approved. Starting execution...';
              return { response: approveMsg };
            }

            if (action === 'NOTES') {
              await this.cacheManager.set(
                `agent_notes_wait:${uid}`,
                instanceId,
                600 * 1000,
              ); // 10 min
              const msg =
                lang === 'sw'
                  ? 'Tafadhali andika maoni yako kuhusu mpango huu:'
                  : 'Please type your notes or feedback for this plan:';
              await sendAndLog(msg);
              return { response: 'Waiting for notes' };
            }
          }

          if (safeText.startsWith('view_diff:')) {
            const versionId = safeText.split(':')[1];
            const result = await this.aiService.executeTool(
              'view_version_history',
              { auditLogId: versionId },
              {
                userId: sender.id,
                role: sender.role,
                companyId,
                phone,
              },
              sender.role,
              language,
            );
            const formatted = await this.aiService.formatToolResponse(
              result,
              sender,
              companyId || '',
              language,
            );
            await sendAndLog(formatted.text);
            return { response: formatted.text, chatId: chatId || null };
          }

          if (safeText.startsWith('rollback:')) {
            const versionId = safeText.split(':')[1];
            const confirmButtons = {
              type: 'button',
              body: {
                text:
                  language === 'sw'
                    ? 'Je, una uhakika unataka kurejesha mabadiliko haya?'
                    : 'Are you sure you want to rollback this change?',
              },
              action: {
                buttons: [
                  {
                    type: 'reply',
                    reply: {
                      id: `confirm_rollback:${versionId}`,
                      title:
                        language === 'sw' ? 'Ndio, Rejesha' : 'Yes, Rollback',
                    },
                  },
                  {
                    type: 'reply',
                    reply: {
                      id: 'cancel_rollback',
                      title:
                        language === 'sw' ? 'Hapana, Ghairi' : 'No, Cancel',
                    },
                  },
                ],
              },
            };
            await this.whatsappService.sendInteractiveMessage({
              to: phone,
              interactive: confirmButtons,
              companyId,
            });
            return { response: 'Confirming rollback', chatId: chatId || null };
          }

          if (safeText.startsWith('confirm_rollback:')) {
            const versionId = safeText.split(':')[1];
            const result = await this.aiService.executeTool(
              'rollback_change',
              { auditLogId: versionId },
              {
                userId: sender.id,
                role: sender.role,
                companyId,
                phone,
              },
              sender.role,
              language,
            );
            const formatted = await this.aiService.formatToolResponse(
              result,
              sender,
              companyId || '',
              language,
            );
            await sendAndLog(formatted.text);
            return { response: formatted.text, chatId: chatId || null };
          }

          if (safeText === 'cancel_rollback') {
            const msg =
              language === 'sw'
                ? 'Sawa, kurejesha kumeghairiwa.'
                : 'Okay, rollback cancelled.';
            await sendAndLog(msg);
            return { response: msg, chatId: chatId || null };
          }

          if (safeText === 'plan_approve') {
            const staged = await this.staging.retrieve(uid, 'pending_action');
            if (staged) {
              await this.whatsappService.sendReaction({
                to: phone,
                messageId: messageId as string,
                emoji: '⏳',
              });
              const result: AiServiceChatResponse = await this.aiService.chat(
                staged.history,
                staged.text,
                staged.chatId,
                companyId,
                undefined,
                staged.attachments,
                lang,
                staged.classification,
                phone,
                undefined,
                true,
              );
              await sendAndLog(result.response, undefined, result.interactive);
              await this.staging.purge(uid);
              return result;
            }
            const result = await this.aiService.executePlan(sender.id, phone);
            await sendAndLog(result.response);
            return result;
          }

          if (safeText === 'plan_cancel' || safeText === 'correction_cancel') {
            const session = await this.cacheManager.get<any>(
              `ai_session:${uid}`,
            );
            if (session) {
              delete session.pendingConfirmation;
              await this.cacheManager.set(`ai_session:${uid}`, session);
            }
            await this.staging.purge(uid);
            const cancelMsg =
              language === 'sw'
                ? 'Sawa, mpango umefutwa.'
                : 'Got it, plan cancelled.';
            await sendAndLog(cancelMsg);
            return { response: cancelMsg, chatId: chatId || null };
          }

          // Handle Failure Reason request
          if (safeText.startsWith('fail_reason:')) {
            const errorId = safeText.split(':')[1];
            const errorDetail = await this.cacheManager.get(
              `fail_reason:${errorId}`,
            );
            const response = errorDetail
              ? language === 'sw'
                ? `Maelezo ya kosa: ${errorDetail}`
                : `Error details: ${errorDetail}`
              : language === 'sw'
                ? 'Samahani, sikuweza kupata maelezo ya kosa hili.'
                : "Sorry, I couldn't find the details for this error.";

            await sendAndLog(response);
            if (messageId)
              await this.whatsappService.sendReaction({
                to: phone,
                messageId,
                emoji: 'ℹ️',
              });
            return { response, chatId: chatId || lastChat?.id || null };
          }

          // Handle Native WhatsApp Authorization
          if (
            safeText.startsWith('auth_approve:') ||
            safeText.startsWith('auth_deny:')
          ) {
            const [action, actionId] = safeText.split(':');
            const isApprove = action === 'auth_approve';

            if (isApprove) {
              await this.whatsappService.sendReaction({
                to: phone,
                messageId: messageId as string,
                emoji: "⏳",
              });
              const updatedRequest = await this.quorumBridge.addApproval(
                actionId,
                sender.id,
              );

              if (
                updatedRequest &&
                updatedRequest.status === AuthorizationStatus.QUORUM_MET
              ) {
                // AUTOMATED EXECUTION: Quorum met, proceed immediately.
                const ctx = {
                  userRole: sender.role,
                  role: sender.role,
                  isSuperAdmin: sender.role === UserRole.SUPER_ADMIN,
                  companyId,
                  userId: sender.id,
                  phone,
                  chatId: chatId || lastChat?.id,
                };

                const actionResult = await this.aiService.executeTool(
                  updatedRequest.actionType,
                  updatedRequest.payload,
                  ctx,
                  sender.role,
                  lang,
                );

                const formatted = await this.aiService.formatToolResponse(
                  actionResult,
                  sender,
                  companyId || '',
                  lang,
                );

                await sendAndLog(
                  formatted.text,
                  undefined,
                  formatted.interactive,
                );

                if (messageId) {
                  await this.whatsappService.sendReaction({
                    to: phone,
                    messageId: messageId as string,
                    emoji: "✅",
                  });
                }
                return { response: formatted.text, chatId: ctx.chatId || null };
              }

              // Quorum not yet met
              const successMsg =
                lang === 'sw'
                  ? '✅ Uidhinishaji wako umerekodiwa. Tunangoja idhini zaidi.'
                  : '✅ Your approval has been recorded. Waiting for more authorizations.';
              await sendAndLog(successMsg);
            } else {
              const denyMsg =
                lang === 'sw'
                  ? '❌ Uidhinishaji umekataliwa. Hatua imefutwa.'
                  : '❌ Authorization rejected. The action has been cancelled.';
              await sendAndLog(denyMsg);
            }
            if (messageId)
              await this.whatsappService.sendReaction({
                to: phone,
                messageId: messageId,
                emoji: '🛡️',
              });
            return {
              response: 'Auth processed',
              chatId: chatId || lastChat?.id || null,
            };
          }

          // Handle Correction Loop (Actionable Echo)
          if (safeText === 'correction_proceed') {
            const staged = await this.staging.retrieve(uid, 'pending_action');
            if (staged) {
              await this.whatsappService.sendReaction({
                to: phone,
                messageId: messageId as string,
                emoji: '⏳',
              });
              const result: AiServiceChatResponse = await this.aiService.chat(
                staged.history,
                staged.text,
                staged.chatId,
                companyId,
                undefined,
                staged.attachments,
                lang,
                staged.classification,
                phone,
                undefined,
                true,
              );
              await sendAndLog(result.response, undefined, result.interactive);
              await this.staging.purge(uid);
              return result;
            }
          }

          if (safeText === 'correction_cancel') {
            await this.staging.purge(uid);
            const cancelMsg =
              lang === 'sw' ? '❌ Hatua imefutwa.' : '❌ Action cancelled.';
            await sendAndLog(cancelMsg);
            if (messageId)
              await this.whatsappService.sendReaction({
                to: phone,
                messageId: messageId,
                emoji: '🗑️',
              });
            return {
              response: cancelMsg,
              chatId: chatId || lastChat?.id || null,
            };
          }

          if (safeText === 'correction_edit') {
            const editMsg =
              lang === 'sw'
                ? 'Tafadhali andika maelekezo sahihi au rudia ujumbe wako.'
                : 'Please type the correct instruction or repeat your message.';
            await sendAndLog(editMsg);
            return {
              response: editMsg,
              chatId: chatId || lastChat?.id || null,
            };
          }

          // Handle intent disambiguation choice
          if (safeText.startsWith('intent_choose:')) {
            const chosen = safeText.split(':')[1] || '';
            if (chosen === 'cancel') {
              await this.staging.delete(uid, 'pending_intent_choice');
              const cancelMsg =
                lang === 'sw' ? '❌ Hatua imefutwa.' : '❌ Action cancelled.';
              await sendAndLog(cancelMsg);
              return {
                response: cancelMsg,
                chatId: chatId || lastChat?.id || null,
              };
            }

            const staged = await this.staging.retrieve<any>(
              uid,
              'pending_intent_choice',
            );
            if (!staged) {
              const expiredMsg =
                lang === 'sw'
                  ? 'Ombi hili limekwisha muda. Tafadhali tuma tena ujumbe wako.'
                  : 'That choice expired. Please resend your message.';
              await sendAndLog(expiredMsg);
              return {
                response: expiredMsg,
                chatId: chatId || lastChat?.id || null,
              };
            }

            const chosenIntent = chosen.trim();
            const writeIntents = [
              'record_payment',
              'add_tenant',
              'onboard_property',
              'update_property',
              'create_unit',
              'create_lease',
              'bulk_create_tenants',
              'import_tenants',
            ];
            const isWrite = writeIntents.includes(chosenIntent);

            const overrideClassification = {
              ...(staged.classification || {}),
              intent: chosenIntent,
              executionMode: isWrite ? 'ORCHESTRATED' : 'DIRECT_LOOKUP',
              complexity: isWrite ? 2 : 1,
              confidence: 1,
              reason: 'User selected intent',
            };

            if (messageId) {
              await this.whatsappService.sendReaction({
                to: phone,
                messageId: messageId as string,
                emoji: '⏳',
              });
            }

            const result: AiServiceChatResponse = await this.aiService.chat(
              staged.history || [],
              staged.text,
              staged.chatId,
              companyId,
              undefined,
              staged.attachments,
              lang,
              overrideClassification,
              phone,
            );

            await sendAndLog(result.response, undefined, result.interactive);
            
            // Safety check: if tool returned confirmation required but AI didn't provide buttons
            if (!result.interactive && result.metadata?.requires_confirmation) {
	               await this.staging.stage(uid, 'pending_action', {
	                 text: (staged as any).text,
	                 classification: overrideClassification || (staged as any).classification,
	                 history: staged.history || [],
	                 chatId: staged.chatId,
	                 attachments: staged.attachments,
	               }, 24 * 3600 * 1000);

               const proceedButtons = {
                  type: 'button',
                  body: { text: lang === 'sw' ? 'Je, ungependa kuendelea?' : 'Would you like to proceed?' },
                  action: {
                    buttons: [
                      { type: 'reply', reply: { id: 'plan_approve', title: lang === 'sw' ? 'Ndio, Endelea' : 'Yes, Proceed' } },
                      { type: 'reply', reply: { id: 'plan_cancel', title: lang === 'sw' ? 'Hapana, Ghairi' : 'No, Cancel' } }
                    ]
                  }
               };
               await this.whatsappService.sendInteractiveMessage({ to: phone, interactive: proceedButtons, companyId });
            }

            await this.staging.delete(uid, 'pending_intent_choice');
            return result;
          }

          // Handle UUID selection (from List Message)
          if (isUuidSelection) {
            const ctx = {
              userRole: sender.role,
              role: sender.role,
              isSuperAdmin: sender.role === UserRole.SUPER_ADMIN,
              companyId,
              userId: sender.id,
              phone,
              chatId: chatId || lastChat?.id,
            };
            const company = await this.prisma.company.findUnique({
              where: { id: safeText },
            });
            if (company) {
              await this.cacheManager.del(listKey);
              const actionResult = await this.aiService.executeTool(
                'select_company',
                { companyId: safeText },
                ctx,
                sender.role,
                lang,
              );
              const formatted = await this.aiService.formatToolResponse(
                actionResult,
                sender,
                safeText,
                lang,
              );
              await sendAndLog(
                formatted.text,
                undefined,
                formatted.interactive,
              );
              if (messageId)
                await this.whatsappService.sendReaction({
                  to: phone,
                  messageId,
                  emoji: '✅',
                });
              return { response: formatted.text, chatId: ctx.chatId || null };
            }
          }
          
          if (activeRecovery && isNumericSelection) {
            const choice = safeText.replace(/\D/g, '');
            if (choice === '1') {
              this.logger.log(`[Recovery] Retrying action: ${activeRecovery.action}`);
              await this.cacheManager.del(recoveryKey);
              
              if (activeRecovery.action === 'execute_tool' && activeRecovery.toolName) {
                const result = await this.aiService.executeTool(
                  activeRecovery.toolName,
                  activeRecovery.args,
                  {
                    userId: sender.id,
                    role: sender.role,
                    companyId,
                    phone,
                    chatId,
                  },
                  sender.role,
                  lang
                );
                const formatted = await this.aiService.formatToolResponse(
                  result,
                  sender,
                  companyId || '',
                  lang
                );
                await sendAndLog(formatted.text, undefined, formatted.interactive);
                return { response: formatted.text, chatId };
              }
              
              if (activeRecovery.action === 'retry_plan_approve') {
                return await this.handleIncomingWhatsapp(
                  phone,
                  'plan_approve',
                  undefined,
                  undefined,
                  `retry_${Date.now()}`,
                );
              }

              if (activeRecovery.originalText) {
                return await this.handleIncomingWhatsapp(
                  phone,
                  activeRecovery.originalText,
                  undefined,
                  undefined,
                  `retry_${Date.now()}`,
                );
              }

              const retryMsg =
                lang === 'sw'
                  ? 'Ombi la kujaribu tena limekwisha muda. Tafadhali tuma tena ujumbe wako.'
                  : 'That retry expired. Please resend your request.';
              await sendAndLog(retryMsg);
              return { response: retryMsg, chatId };
            } else if (choice === '2') {
               await this.cacheManager.del(recoveryKey);
               const menu = this.mainMenu.getMainMenu(lang, sender.role as any);
               await this.whatsappService.sendInteractiveMessage({
                 to: phone,
                 interactive: menu,
                 companyId
               });
               return { response: 'Main Menu', chatId };
            }
          }

          if (activeList && isNumericSelection) {
            const index = parseInt(safeText.replace(/\D/g, ''), 10) - 1;
            const selected = activeList.items?.[index];
            if (selected) {
              await this.cacheManager.del(listKey);
              const ctx = {
                userRole: sender.role,
                role: sender.role,
                isSuperAdmin: sender.role === UserRole.SUPER_ADMIN,
                companyId,
                userId: sender.id,
                phone,
                chatId: activeList.chatId || chatId,
              };
              const action = activeList.action || 'select_company';
              const idField = activeList.idField || 'companyId';
              const actionResult = await this.aiService.executeTool(
                action,
                { [idField]: selected.id },
                ctx,
                sender.role,
                lang,
              );
              const formatted = await this.aiService.formatToolResponse(
                actionResult,
                sender,
                selected.id,
                lang,
              );
              await sendAndLog(
                formatted.text,
                undefined,
                formatted.interactive,
              );
              if (messageId)
                await this.whatsappService.sendReaction({
                  to: phone,
                  messageId,
                  emoji: '✅',
                });
              return {
                response: formatted.text,
                chatId: activeList.chatId || chatId || null,
              };
            }
          }

          // Priority 1.5 - Orchestrated options
          if (isNumericSelection) {
            const session = await this.cacheManager.get<any>(
              `ai_session:${uid}`,
            );
            if (
              session &&
              session.pendingConfirmation &&
              session.pendingConfirmation.options
            ) {
              const optionKey = safeText.replace(/\D/g, '');
              const orchestratedAction =
                session.pendingConfirmation.options[optionKey];
              if (orchestratedAction) {
                delete session.pendingConfirmation;
                await this.cacheManager.set(
                  `ai_session:${uid}`,
                  session,
                  3600 * 1000,
                );
                if (orchestratedAction === 'execute_plan') {
                  const result = await this.aiService.executePlan(
                    sender.id,
                    phone,
                  );
                  await sendAndLog(result.response);
                  return result;
                }
                if (orchestratedAction === 'cancel_plan') {
                  const cancelMsg =
                    lang === 'sw'
                      ? 'Sawa, mpango umefutwa.'
                      : 'Got it, plan cancelled.';
                  await sendAndLog(cancelMsg);
                  return { response: cancelMsg, chatId: chatId || null };
                }
                const parts = orchestratedAction.split(':');
                const toolName = parts[0];
                const entityId = parts[1];
                const extra = parts[2];
                const args: any = {};
                if (entityId) {
                  if (toolName.includes('tenant')) args.tenantId = entityId;
                  else if (toolName.includes('property'))
                    args.propertyId = entityId;
                  else if (toolName.includes('unit')) args.unitId = entityId;
                  else if (
                    toolName.includes('lease') ||
                    toolName.includes('penalty')
                  )
                    args.leaseId = entityId;
                }
                const actionResult = await this.aiService.executeTool(
                  toolName,
                  args,
                  {
                    userRole: sender.role,
                    role: sender.role,
                    isSuperAdmin: sender.role === UserRole.SUPER_ADMIN,
                    companyId,
                    userId: sender.id,
                    phone,
                    chatId: chatId,
                  },
                  sender.role,
                  lang,
                );
                const formatted = await this.aiService.formatToolResponse(
                  actionResult,
                  sender,
                  companyId || '',
                  lang,
                );
                await sendAndLog(
                  formatted.text,
                  undefined,
                  formatted.interactive,
                );
                if (messageId)
                  await this.whatsappService.sendReaction({
                    to: phone,
                    messageId,
                    emoji: '✅',
                  });
                return { response: formatted.text, chatId: chatId || null };
              }
            }
          }

          if (!isNumericSelection && !safeText.startsWith('/')) {
            await this.cacheManager.del(listKey);
            const session = await this.cacheManager.get<any>(
              `ai_session:${uid}`,
            );
            if (session && session.awaitingSelection) {
              delete session.awaitingSelection;
              await this.cacheManager.set(
                `ai_session:${uid}`,
                session,
                3600 * 1000,
              );
            }
          }

          const menuRoute = await this.menuRouter.routeMessage(uid, text, lang);
          if (menuRoute.handled) {
            if (menuRoute.tool) {
              const actionResult = await this.aiService.executeTool(
                menuRoute.tool.name,
                menuRoute.tool.args || {},
                {
                  userRole: sender.role,
                  role: sender.role,
                  isSuperAdmin: sender.role === UserRole.SUPER_ADMIN,
                  companyId,
                  userId: sender.id,
                  phone,
                  chatId: chatId,
                },
                sender.role,
                lang,
              );
              const targetCompanyId =
                menuRoute.tool.args?.companyId || companyId || '';
              const formatted = await this.aiService.formatToolResponse(
                actionResult,
                sender,
                targetCompanyId,
                lang,
              );
              let finalResponse = formatted.text;
              if (menuRoute.response)
                finalResponse = `${menuRoute.response}\n\n${finalResponse}`;
              await sendAndLog(finalResponse, undefined, formatted.interactive);
              if (messageId)
                await this.whatsappService.sendReaction({
                  to: phone,
                  messageId,
                  emoji: '✅',
                });
              return { response: finalResponse, chatId: chatId || null };
            }
            if (menuRoute.response) {
              await sendAndLog(menuRoute.response);
              return { response: menuRoute.response, chatId: chatId || null };
            }
          }

          if (text?.trim().toLowerCase() === '/reset') {
            if (lastChat?.id)
              await this.aiService.deleteChatSession(lastChat.id);
            const resetMsg =
              language === 'sw'
                ? '🔄 Muktadha wa mazungumzo umewekwa upya.'
                : '🔄 Chat context has been reset.';
            await sendAndLog(resetMsg);
            return { response: resetMsg, chatId: null };
          }

          const lowered = text?.trim().toLowerCase() || '';
          const fastTextTools: Record<string, { name: string; args?: any }> = {
            'list companies': { name: 'list_companies' },
            'show companies': { name: 'list_companies' },
            companies: { name: 'list_companies' },
          };
          if (fastTextTools[lowered]) {
            const tool = fastTextTools[lowered];
            const actionResult = await this.aiService.executeTool(
              tool.name,
              tool.args || {},
              {
                userRole: sender.role,
                role: sender.role,
                isSuperAdmin: sender.role === UserRole.SUPER_ADMIN,
                companyId,
                userId: sender.id,
                phone,
              },
              sender.role,
              lang,
            );
            const formatted = await this.aiService.formatToolResponse(
              actionResult,
              sender,
              companyId || '',
              lang,
            );
            await sendAndLog(formatted.text, undefined, formatted.interactive);
            if (messageId)
              await this.whatsappService.sendReaction({
                to: phone,
                messageId,
                emoji: '✅',
              });
            return { response: formatted.text, chatId: chatId || null };
          }

          const quickContext = {
            userId: sender.id,
            role: sender.role,
            companyId: companyId,
            userName: (waProfile as any)?.name || 'there',
            phone,
          } as any;
          if (text) {
            const directResponse = await tryDirectTool(
              text,
              quickContext,
              this.prisma,
              this.aiService.executeTool.bind(this.aiService),
              language || 'en',
              this.cacheManager,
            );
            if (directResponse) {
              if (!chatId) {
                const chatHistory = await this.prisma.chatHistory.create({
                  data: {
                    ...(sender.id !== 'unidentified'
                      ? { userId: sender.id }
                      : { waPhone: phone }),
                    companyId: companyId,
                    title: text.substring(0, 50),
                  },
                });
                chatId = chatHistory.id;
              }
              await this.prisma.chatMessage.create({
                data: { chatHistoryId: chatId, role: 'user', content: text },
              });
              const actionResult =
                typeof directResponse === 'string'
                  ? { success: true, data: directResponse, action: 'direct' }
                  : directResponse;
              const formatted = await this.aiService.formatToolResponse(
                actionResult,
                sender,
                companyId || '',
                lang,
              );
              await sendAndLog(
                formatted.text,
                undefined,
                formatted.interactive || actionResult.interactive,
              );
              if (messageId)
                await this.whatsappService.sendReaction({
                  to: phone,
                  messageId,
                  emoji: '✅',
                });
              return { response: formatted.text, chatId };
            }
          }

          const attachments: any[] = [];
          if (mediaId && mimeType) {
            try {
              const media =
                downloadedMedia ||
                (await this.whatsappService.downloadMedia(mediaId, companyId));
              attachments.push(media);
            } catch (e) {
              this.logger.error(
                `Failed to download WhatsApp media: ${e.message}`,
              );
            }
          }

          const effectiveText = text || (mediaId ? '[Attachment]' : '');
          
          // Mombasa Market Hard-Interception (Entry Point)
          let classification: ClassificationResult | null = this.interceptSwahiliEmergency(effectiveText);
          
          if (!classification) {
            try {
              classification = await Promise.race([
                this.classifier.classify(effectiveText, sender.role),
                new Promise<any>((_, reject) =>
                  setTimeout(
                    () => reject(new Error('Classification timeout')),
                    10000,
                  ),
                ),
              ]);
            } catch (err: any) {
              classification = {
                intent: 'unknown',
                priority: 'NORMAL',
                complexity: 2,
                executionMode: 'LIGHT_COMPOSE',
                language: 'en',
                reason: 'Timeout fallback',
                confidence: 0.3,
              };
            }
          }

          if (!classification) {
            this.logger.error(`Failed to classify message: ${effectiveText}`);
            return { response: 'Classification failure', chatId: lastChat?.id || null };
          }

          if (
            classification.language !== 'mixed' &&
            classification.language !== language
          )
            language = classification.language;

          // ACTIONABLE ECHO LOGIC
          const writeIntents = [
            'record_payment',
            'add_tenant',
            'onboard_property',
            'update_property',
            'create_unit',
            'create_lease',
            'bulk_create_tenants',
            'import_tenants',
          ];
          const isWriteAction =
            writeIntents.includes(classification.intent) ||
            classification.executionMode === 'ORCHESTRATED';

          const explicitWrite =
            /\b(make|add|create|record|update|delete|register|import|assign|mark|onboard)\b/i.test(
              effectiveText,
            ) ||
            /\b(ongeza|tengeneza|rekodi|sasisha|futa|sajili|ingiza|weka|badilisha)\b/i.test(
              effectiveText,
            );
          const confidence =
            typeof classification.confidence === 'number'
              ? classification.confidence
              : 0.6;
          const looksLikePropertyRef =
            /house\s*(?:no\.?|number|#)?\s*\d+|house\s*\d+|\bunit\s+[a-z0-9_-]+\b|nyumba\s*\d+/i.test(
              effectiveText,
            );
          const looksLikeInterest =
            /interested|intrested|available|vacant|for\s+rent|renting|to\s+rent|view(ing)?|visit|schedule|nataka\s+kupanga|ipo\s*waz/i.test(
              effectiveText.toLowerCase(),
            );

	          const isLongPrompt = effectiveText.length > 60 || effectiveText.split(' ').length > 8;
	          // Avoid competing "shadow classifier" logic when a deterministic route exists.
	          const deterministic = await this.menuRouter.routeMessage(
	            uid,
	            effectiveText,
	            lang,
	          );
	          const requiresDisambiguation =
	            !deterministic.handled &&
	            !isLongPrompt &&
	            looksLikePropertyRef &&
	            (!explicitWrite || confidence < 0.75);

          // Dynamic disambiguation: avoid robotic confirmations, ALWAYS trigger for explicit List Selections
          if (
            isListSelection ||
            (requiresDisambiguation &&
             (isWriteAction ||
              classification.intent === 'general_query' ||
              classification.intent === 'unknown'))
          ) {
            let history: any[] = [];
            if (lastChat?.id) {
              const messages = await this.aiService.getChatHistory(lastChat.id);
              history = messages.slice(-15).map((m) => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
              }));
              while (history.length > 0 && history[0].role !== 'user')
                history.shift();
            }

	            await this.staging.stage(uid, 'pending_intent_choice', {
	              text: effectiveText,
	              classification,
	              history,
	              chatId: lastChat?.id,
	              attachments,
	            }, 24 * 3600 * 1000);

            // --- Dynamic intent-aware disambiguation ---
            // Map the LLM's classified intent to the options most relevant in that context.
            // Fallback to a generic set when the intent is unknown/general.
            type DisambigOption = { key: string; label: string; labelSw: string; action: string };
            const intentOptionsMap: Record<string, DisambigOption[]> = {
              // Property creation family
              onboard_property: [
                { key: 'create',  label: 'Create property',       labelSw: 'Unda jengo',            action: 'intent_choose:onboard_property' },
                { key: 'details', label: 'View properties',        labelSw: 'Ona majengo',            action: 'intent_choose:get_property_details' },
              ],
              update_property: [
                { key: 'update',  label: 'Update property',        labelSw: 'Sasisha jengo',          action: 'intent_choose:update_property' },
                { key: 'details', label: 'View property details',  labelSw: 'Maelezo ya jengo',       action: 'intent_choose:get_property_details' },
              ],
              // Unit family
              create_unit: [
                { key: 'create',  label: 'Create unit',            labelSw: 'Unda kitengo',           action: 'intent_choose:create_unit' },
                { key: 'vacancy', label: 'Check availability',     labelSw: 'Angalia upatikanaji',    action: 'intent_choose:check_vacancy' },
              ],
              // Tenant registration family
              add_tenant: [
                { key: 'tenant',  label: 'Register tenant',        labelSw: 'Sajili mpangaji',        action: 'intent_choose:add_tenant' },
                { key: 'details', label: 'View tenants',           labelSw: 'Ona wapangaji',          action: 'intent_choose:list_tenants' },
              ],
              bulk_create_tenants: [
                { key: 'bulk',    label: 'Import tenants',         labelSw: 'Ingiza wapangaji',       action: 'intent_choose:bulk_create_tenants' },
                { key: 'tenant',  label: 'Register one tenant',    labelSw: 'Sajili mpangaji mmoja',  action: 'intent_choose:add_tenant' },
              ],
              // Lease family
              create_lease: [
                { key: 'lease',   label: 'Create lease',           labelSw: 'Unda mkataba',           action: 'intent_choose:create_lease' },
                { key: 'tenant',  label: 'View tenant details',    labelSw: 'Maelezo ya mpangaji',    action: 'intent_choose:get_tenant_details' },
              ],
              // Property inquiry / availability family
              get_property_details: [
                { key: 'details', label: 'View details',           labelSw: 'Maelezo',                action: 'intent_choose:get_property_details' },
                { key: 'vacancy', label: 'Check availability',     labelSw: 'Upatikanaji',            action: 'intent_choose:check_vacancy' },
                { key: 'tenant',  label: 'Register tenant',        labelSw: 'Sajili mpangaji',        action: 'intent_choose:add_tenant' },
              ],
              check_vacancy: [
                { key: 'vacancy', label: 'Check availability',     labelSw: 'Angalia upatikanaji',    action: 'intent_choose:check_vacancy' },
                { key: 'details', label: 'View property details',  labelSw: 'Maelezo ya jengo',       action: 'intent_choose:get_property_details' },
              ],
            };

            // Derive contextual prompt text based on the intent family
            const intentAskMap: Partial<Record<string, { en: string; sw: string }>> = {
              onboard_property:     { en: 'Would you like to create a new property?',    sw: 'Unataka kuunda jengo jipya?' },
              update_property:      { en: 'Do you want to update this property?',        sw: 'Unataka kusasisha jengo hili?' },
              create_unit:          { en: 'Do you want to create a new unit here?',      sw: 'Unataka kuunda kitengo kipya?' },
              add_tenant:           { en: 'Do you want to register a tenant here?',      sw: 'Unataka kusajili mpangaji?' },
              bulk_create_tenants:  { en: 'Do you want to import tenants here?',         sw: 'Unataka kuingiza wapangaji?' },
              create_lease:         { en: 'Do you want to create a lease agreement?',    sw: 'Unataka kuunda mkataba?' },
              get_property_details: { en: 'What would you like to do with this property?', sw: 'Unataka kufanya nini na jengo hili?' },
              check_vacancy:        { en: 'What would you like to do with this property?', sw: 'Unataka kufanya nini na jengo hili?' },
            };

            const resolvedIntent = classification.intent as string;
            const resolvedOptions = (intentOptionsMap[resolvedIntent] ?? (() => {
              // Generic fallback for unknown/general intents, intelligent based on list selection type
              if (listSelectionType === 'tenant') {
                return [
                  { key: 'details', label: 'View tenant',        labelSw: 'Ona mpangaji',    action: 'intent_choose:get_tenant_details' },
                  { key: 'lease',   label: 'Create lease',       labelSw: 'Unda mkataba',    action: 'intent_choose:create_lease' },
                  { key: 'pay',     label: 'Record payment',     labelSw: 'Rekodi malipo',   action: 'intent_choose:record_payment' },
                ];
              } else if (listSelectionType === 'unit') {
                return [
                  { key: 'details', label: 'View unit',          labelSw: 'Ona kitengo',     action: 'intent_choose:get_unit_details' },
                  { key: 'vacancy', label: 'Check vacancy',      labelSw: 'Angalia upatikanaji', action: 'intent_choose:check_vacancy' },
                  { key: 'lease',   label: 'Create lease',       labelSw: 'Unda mkataba',    action: 'intent_choose:create_lease' },
                ];
              } else if (listSelectionType === 'property' || looksLikePropertyRef) {
                return looksLikeInterest
                  ? [
                      { key: 'details', label: 'View details',       labelSw: 'Maelezo',             action: 'intent_choose:get_property_details' },
                      { key: 'vacancy', label: 'Check availability', labelSw: 'Upatikanaji',         action: 'intent_choose:check_vacancy' },
                      { key: 'tenant',  label: 'Register tenant',    labelSw: 'Sajili mpangaji',     action: 'intent_choose:add_tenant' },
                    ]
                  : [
                      { key: 'details', label: 'View details',       labelSw: 'Maelezo',             action: 'intent_choose:get_property_details' },
                      { key: 'create',  label: 'Create property',    labelSw: 'Unda jengo',          action: 'intent_choose:onboard_property' },
                      { key: 'tenant',  label: 'Register tenant',    labelSw: 'Sajili mpangaji',     action: 'intent_choose:add_tenant' },
                    ];
              } else {
                return [
                  { key: 'details', label: 'Explore options',    labelSw: 'Chaguzi',         action: 'intent_choose:general_query' },
                ];
              }
            })());

            const intentAsk = intentAskMap[resolvedIntent];
            const fallbackAskSw = listSelectionType === 'tenant' ? 'Unataka kufanya nini na mpangaji huyu?'
                                : listSelectionType === 'unit' ? 'Unataka kufanya nini na kitengo hiki?'
                                : looksLikeInterest ? 'Unataka kufanya nini na nyumba/kitengo hiki?' : 'Unamaanisha nini kuhusu hili?';
            const fallbackAskEn = listSelectionType === 'tenant' ? 'What would you like to do with this tenant?'
                                : listSelectionType === 'unit' ? 'What would you like to do with this unit?'
                                : looksLikeInterest ? 'What would you like to do with this property?' : 'What do you mean about this?';

            const ask = lang === 'sw' ? (intentAsk?.sw ?? fallbackAskSw) : (intentAsk?.en ?? fallbackAskEn);

            const options = resolvedOptions.map((o) => ({
              key: o.key,
              label: lang === 'sw' ? o.labelSw : o.label,
              action: o.action,
            }));
            // --- End dynamic disambiguation ---

            const interactive = this.whatsappFormatter.buildButtonMessage(
              ask,
              options.slice(0, 3), // WhatsApp allows max 3 buttons
              lang,
            );
            await sendAndLog(ask, undefined, interactive);
            return { response: ask, chatId: lastChat?.id || null };
          }


          if (
            isWriteAction &&
            classification.executionMode !== 'PLANNING' &&
            !safeText.startsWith('correction_')
          ) {
            const humanIntents: Record<string, string> = {
              record_payment:
                lang === 'sw'
                  ? 'Kurekodi malipo ya kodi'
                  : 'Recording a rent payment',
              add_tenant:
                lang === 'sw'
                  ? 'Kumsajili mpangaji mpya'
                  : 'Onboarding a new tenant',
              onboard_property:
                lang === 'sw'
                  ? 'Kuongeza jengo jipya'
                  : 'Adding a new property',
              create_unit:
                lang === 'sw' ? 'Kuunda kitengo kipya' : 'Creating a new unit',
              create_lease:
                lang === 'sw'
                  ? 'Kuunda mkataba mpya wa upangaji'
                  : 'Creating a new lease agreement',
              bulk_create_tenants:
                lang === 'sw'
                  ? 'Kusajili wapangaji wengi'
                  : 'Registering multiple tenants',
              import_tenants:
                lang === 'sw'
                  ? 'Kuweka majina ya wapangaji'
                  : 'Importing tenant list',
              update_property:
                lang === 'sw'
                  ? 'Kusasisha taarifa za jengo'
                  : 'Updating property details',
            };
            let intentDesc =
              humanIntents[classification.intent] ||
              (lang === 'sw'
                ? 'Kutekeleza ombi lako'
                : 'Processing your request');
            const hasCompoundSteps =
              classification.executionMode === 'ORCHESTRATED' &&
              Array.isArray(classification.subIntents) &&
              classification.subIntents.length > 1;
            if (hasCompoundSteps) {
              intentDesc =
                lang === 'sw' ? 'Ombi lenye hatua kadhaa' : 'Multi-step request';
            }
            const label =
              !explicitWrite && confidence < 0.75
                ? lang === 'sw'
                  ? '📝 Inawezekana unamaanisha'
                  : '📝 Possible action'
                : lang === 'sw'
                  ? '📝 Kusudi'
                  : '📝 Intent';

            const stepsPreview = hasCompoundSteps
              ? (() => {
                  const maxSteps = 3;
                  const phrases = (classification.subIntents || [])
                    .slice(0, maxSteps)
                    .map((i) => humanIntents[i] || i);
                  const extra =
                    (classification.subIntents || []).length > maxSteps
                      ? lang === 'sw'
                        ? ` +${(classification.subIntents || []).length - maxSteps} zaidi`
                        : ` +${(classification.subIntents || []).length - maxSteps} more`
                      : '';
                  const joiner = lang === 'sw' ? ' → ' : ' → ';
                  const prefix = lang === 'sw' ? '🧩 Hatua' : '🧩 Steps';
                  return `\n${prefix}: ${phrases.join(joiner)}${extra}`;
                })()
              : '';

            const echoBody =
              lang === 'sw'
                ? `🎤 Nimepokea ujumbe wako.\n✍️ Nilichosikia: "${effectiveText}"\n${label}: ${intentDesc}${stepsPreview}`
                : `🎤 Received your request.\n✍️ I heard: "${effectiveText}"\n${label}: ${intentDesc}${stepsPreview}`;

            let history: any[] = [];
            if (lastChat?.id) {
              const messages = await this.aiService.getChatHistory(lastChat.id);
              history = messages.slice(-15).map((m) => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
              }));
              while (history.length > 0 && history[0].role !== 'user')
                history.shift();
            }

	            await this.staging.stage(uid, 'pending_action', {
	              text: effectiveText,
	              classification,
	              history,
	              chatId: lastChat?.id,
	              attachments,
	            }, 24 * 3600 * 1000);
            if (classification.executionMode === 'ORCHESTRATED') {
              const planButtons = this.crudButtons.buildPlanButtons(
                intentDesc,
                lang,
              );
              await sendAndLog(echoBody, undefined, planButtons);
            } else {
              const interactive =
                this.whatsappFormatter.buildActionableEchoButtons(
                  echoBody,
                  lang,
                );
              await sendAndLog(echoBody, undefined, interactive);
            }
            return { response: echoBody, chatId: lastChat?.id || null };
          }

          if (
            classification.complexity >= 4 ||
            classification.executionMode === 'INTELLIGENCE'
          ) {
            const holdingMsg =
              language === 'sw'
                ? 'Ninaandaa ripoti yako kamili...'
                : 'Generating your full portfolio report...';
            await sendAndLog(holdingMsg);
          }

          let history: any[] = [];
          if (lastChat?.id) {
            const messages = await this.aiService.getChatHistory(lastChat.id);
            history = messages.slice(-15).map((m) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }],
            }));
            while (history.length > 0 && history[0].role !== 'user')
              history.shift();
          }

          const result: AiServiceChatResponse = await this.aiService.chat(
            history,
            effectiveText,
            lastChat?.id,
            companyId,
            undefined,
            attachments,
            language || undefined,
            classification,
            phone,
          );

          if (result.response) {
            let finalResponse = this.stripJsonBlocks(result.response);
            if (finalResponse.length > 800)
              finalResponse = await this.summarizeForWhatsApp(
                finalResponse,
                language ?? undefined,
              );

            const tools = Array.isArray(result.metadata?.tools)
              ? result.metadata!.tools
              : [];
            const listishTools = new Set([
              'list_tenants',
              'search_tenants',
              'list_properties',
              'search_properties',
              'list_units',
              'search_units',
              'list_companies',
              'search_companies',
            ]);
            const cameFromListTool = tools.some((t: string) =>
              listishTools.has(String(t || '').trim()),
            );
            const responseLooksLikeSelection =
              /selection required|select\b|choose\b|chagua\b|hagua\b|which\b|mean\b|match|found\b|correct\b/i.test(
                finalResponse,
              );

            const needsClarification =
              !!result.metadata?.clarificationNeeded || responseLooksLikeSelection;
            if (!result.interactive && needsClarification) {
              const justCachedList: any = await this.cacheManager.get(
                `list:${uid}`,
              );
              if (!justCachedList && (cameFromListTool || responseLooksLikeSelection)) {
                this.logger.warn(
                  `[WhatsApp] Clarification needed but no list found in cache for ${uid}`,
                );
              }

              if (justCachedList?.items?.length > 0) {
                const items = justCachedList.items.slice(0, 10);
                result.interactive = {
                  type: 'list',
                  header: {
                    type: 'text',
                    text: language === 'sw' ? 'Chagua hapa' : 'Selection Required',
                  },
                  body: { text: finalResponse.slice(0, 1024) },
                  action: {
                    button: language === 'sw' ? 'Chagua moja' : 'Select Option',
                    sections: [
                      {
                        title: 'Results',
                        rows: items.map((item: any) => ({
                          id: item.id,
                          title: item.name.slice(0, 24),
                          description: item.type,
                        })),
                      },
                    ],
                  },
                };
              }
            }

            // Version-control buttons: fire after every successful mutation that returned a _vc summary.
            // This is independent of clarification; it should always appear after a create/update/delete.
            if (!result.interactive && result.vcSummary?.versionId) {
              result.interactive = this.crudButtons.buildCrudButtons(
                result.vcSummary,
                language || 'en',
              );
            }


            if (result.requires_authorization) {
              const session = (await this.cacheManager.get<any>(
                `ai_session:${uid}`,
              )) || { userId: uid };
              session.pendingComplexTask = {
                message: text,
                classification,
                context: {
                  chatId: lastChat?.id || chatId,
                  companyId,
                  userId: sender.id,
                  role: sender.role,
                  phone,
                },
                attachments,
              };
              await this.cacheManager.set(
                `ai_session:${uid}`,
                session,
                3600 * 1000,
              );
            }

            if (!result.interactive && result.metadata?.requires_confirmation) {
	               await this.staging.stage(uid, 'pending_action', {
	                 text,
	                 classification,
	                 history,
	                 chatId: lastChat?.id || chatId,
	                 attachments,
	               }, 24 * 3600 * 1000);

               result.interactive = {
                  type: 'button',
                  body: { text: language === 'sw' ? 'Je, ungependa kuendelea?' : 'Would you like to proceed?' },
                  action: {
                    buttons: [
                      { type: 'reply', reply: { id: 'plan_approve', title: language === 'sw' ? 'Ndio, Endelea' : 'Yes, Proceed' } },
                      { type: 'reply', reply: { id: 'plan_cancel', title: language === 'sw' ? 'Hapana, Ghairi' : 'No, Cancel' } }
                    ]
                  }
               };
            }

            await sendAndLog(
              finalResponse,
              undefined,
              result.interactive,
              true,
            );
            result.response = finalResponse;
          }

          if (
            'generatedFiles' in result &&
            result.generatedFiles &&
            result.generatedFiles.length > 0
          ) {
            const docTemplate = process.env.WA_REPORT_TEMPLATE;
            for (const file of result.generatedFiles) {
              try {
                if (docTemplate) {
                  try {
                    await this.whatsappService.sendDocumentTemplate({
                      companyId,
                      to: phone,
                      templateName: docTemplate,
                      url: file.url,
                      fileName: file.fileName,
                    });
                  } catch (templateError) {
                    this.logger.warn(
                      `Template push failed, falling back to direct document: ${templateError.message}`,
                    );
                    await this.whatsappService.sendDocument({
                      companyId,
                      to: phone,
                      url: file.url,
                      fileName: file.fileName,
                      caption: `Strategic Report: ${file.fileName}`,
                    });
                  }
                } else {
                  await this.whatsappService.sendDocument({
                    companyId,
                    to: phone,
                    url: file.url,
                    fileName: file.fileName,
                    caption: `Strategic Report`,
                  });
                }
              } catch (e) {
                this.logger.error(
                  `Failed to push document to WhatsApp (even after fallback): ${e.message}`,
                );
              }
            }
          }

          if (messageId)
            await this.whatsappService.sendReaction({
              to: phone,
              messageId: messageId,
              emoji: '✅',
            });
          return result;
        },
      );
    } catch (err: any) {
      this.logger.error(`Orchestrator loop failed: ${err.message}`, err.stack);
      const userId =
        typeof sender !== 'undefined' && sender ? sender.id : 'unidentified';
      const contextUid = getSessionUid({ userId, phone });
      const recovery = this.recovery.buildInteractiveErrorRecovery(
        'default',
        err,
        { userId },
        (language as any) || 'en',
      );
      
      // Clear stale lists and set recovery context
      await this.cacheManager.del(`list:${contextUid}`);
      await this.cacheManager.set(`recovery:${contextUid}`, {
        action: (text?.trim() || '') === 'plan_approve' ? 'retry_plan_approve' : 'retry_original',
        originalText: text?.trim() || '',
      }, 300 * 1000);

      await this.cacheManager.set(
        `fail_reason:${recovery.errorId}`,
        (() => {
          const raw = String(err?.message || err || 'Unknown error');
          const code = err?.code ? ` code=${String(err.code)}` : '';
          const lower = raw.toLowerCase();
          if (lower.includes('fetch failed')) {
            return `fetch failed (network call to an upstream service failed)${code}`;
          }
          if (lower.includes('timeout') || lower.includes('timed out')) {
            return `timeout (upstream service did not respond in time)${code}`;
          }
          if (lower.includes('econnrefused')) {
            return `connection refused (upstream service unreachable)${code}`;
          }
          return `${raw}${code}`.slice(0, 400);
        })(),
        3600 * 1000,
      ); // 1 hour
      const interactive = this.whatsappFormatter.buildButtonMessage(
        recovery.text,
        recovery.options,
        (language as any) || 'en',
      );
      if (interactive)
        await this.whatsappService.sendInteractiveMessage({
          to: phone,
          interactive,
        });
      else
        await this.whatsappService.sendTextMessage({
          to: phone,
          text: recovery.text,
        });
      if (messageId)
        await this.whatsappService.sendReaction({
          to: phone,
          messageId: messageId,
          emoji: '❌',
        });
      return { response: recovery.text, chatId };
    } finally {
      await this.cacheManager.del(lockKey);
    }
  }

  private async transcribeAudio(
    base64: string,
    mimeType: string,
    language?: string,
  ): Promise<string | null> {
    const buffer = Buffer.from(base64, 'base64');
    try {
      const response: any = await this.groq.audio.transcriptions.create({
        file: await toFile(
          buffer,
          `audio.${mimeType?.split('/')?.[1] || 'ogg'}`,
          { type: mimeType || 'audio/ogg' },
        ),
        model: 'whisper-large-v3-turbo',
        response_format: 'text',
        language: language === 'sw' ? 'sw' : undefined,
      });
      const transcript =
        typeof response === 'string' ? response : response?.text;
      if (transcript) return transcript.trim();
    } catch (error) {
      this.logger.warn(`Groq Whisper transcription failed: ${error.message}`);
    }
    return null;
  }

  private stripJsonBlocks(text: string): string {
    if (!text) return text;
    // Strip markdown-fenced JSON blocks
    let cleaned = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, '');

    // Strip raw JSON objects {} that look like technical data (at least one key-value pair)
    cleaned = cleaned.replace(/\{[\s\S]*?\}/g, (match) => {
      try {
        // Only strip if it looks like a real JSON object with keys
        if (match.length > 10 && match.includes('"') && match.includes(':')) {
          JSON.parse(match);
          return '';
        }
        return match;
      } catch (e) {
        return match;
      }
    });

    // Strip raw JSON arrays []
    cleaned = cleaned.replace(/\[\s*\{[\s\S]*?\}\s*\]/g, (match) => {
      try {
        JSON.parse(match);
        return '';
      } catch (e) {
        return match;
      }
    });

    cleaned = cleaned.replace(/\bjson\b\s*/gim, '');
    return cleaned.trim();
  }

  private async summarizeForWhatsApp(
    text: string,
    language: string = 'en',
  ): Promise<string> {
    try {
      return await this.aiService.summarizeForWhatsApp(text, language);
    } catch (e) {
      return text;
    }
  }

  private async getMenuContext(sender: any, language: string): Promise<any> {
    const context: any = {
      userName:
        sender.name ||
        sender.firstName ||
        (sender.id !== 'unidentified' ? 'there' : 'Guest'),
      role: sender.role,
    };

    try {
      if (sender.role === UserRole.TENANT) {
        const unpaidInvoices = await this.prisma.invoice.aggregate({
          where: {
            lease: { tenantId: sender.id, deletedAt: null },
            status: { not: 'PAID' },
            deletedAt: null,
          },
          _sum: { amount: true },
        });
        context.balanceDue = unpaidInvoices?._sum?.amount || 0;
      } else if (sender.role === UserRole.LANDLORD) {
        if (sender.companyId) {
          context.collectionRate = await this.aiService.getCollectionRate(
            sender.companyId,
          );
        }
      } else if (
        sender.role === UserRole.COMPANY_ADMIN ||
        sender.role === UserRole.COMPANY_STAFF
      ) {
        if (sender.companyId) {
          context.propertyCount = await this.prisma.property.count({
            where: { companyId: sender.companyId, deletedAt: null },
          });
        }
      }
    } catch (e) {
      this.logger.warn(
        `Failed to fetch menu context for ${sender.id}: ${e.message}`,
      );
    }

    return context;
  }

  private interceptSwahiliEmergency(input: string): ClassificationResult | null {
    const msg = input.toLowerCase();
    const combinations = [
      { keywords: ['maji', 'imepotea'], intent: 'emergency' },
      { keywords: ['maji', 'hamna'], intent: 'emergency' },
      { keywords: ['stima', 'imepotea'], intent: 'emergency' },
      { keywords: ['bomba', 'pasuka'], intent: 'emergency' },
      { keywords: ['bomba', 'vunjika'], intent: 'emergency' },
      { keywords: ['moto', 'ungua'], intent: 'emergency' },
    ];

    for (const combo of combinations) {
      if (combo.keywords.every((k) => msg.includes(k))) {
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
}
