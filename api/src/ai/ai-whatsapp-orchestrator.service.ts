import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
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
import { MainMenuService } from './main-menu.service';
import { WhatsAppFormatterService } from './whatsapp-formatter.service';
import { getSessionUid } from './ai-tool-selector.util';
import { QuorumBridgeService } from './quorum-bridge.service';
import { AiStagingService } from './ai-staging.service';
import { WaCrudButtonsService } from './wa-crud-buttons.service';
import { WorkflowEngine } from '../workflows/workflow.engine';
import Groq, { toFile } from 'groq-sdk';
import { AiServiceChatResponse } from './ai-contracts.types';

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
    private readonly whatsappFormatter: WhatsAppFormatterService,
    private readonly quorumBridge: QuorumBridgeService,
    private readonly staging: AiStagingService,
    private readonly crudButtons: WaCrudButtonsService,
    private readonly workflowEngine: WorkflowEngine,
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
    const uid = getSessionUid({ phone });
    const lockKey = `lock:wa:${uid}`;
    const isLocked = await this.cacheManager.get(lockKey);

    this.logger.log(
      `[WhatsApp] Incoming from ${phone} (wamid: ${messageId || 'NONE'}). Lock status: ${!!isLocked}`,
    );

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
        return { response: 'Showing Main Menu', chatId: null };
      }

      // Handle Unidentified user options
      if (sender.role === UserRole.UNIDENTIFIED) {
        if (text === 'auth_register') {
          const resp =
            language === 'sw'
              ? 'Tafadhali andika jina la kampuni yako ili kuanza usajili.'
              : 'Please type your company name to begin registration.';
          await this.whatsappService.sendTextMessage({ to: phone, text: resp });
          return { response: resp, chatId: null };
        }
        if (text === 'auth_support') {
          const resp =
            language === 'sw'
              ? 'Mhudumu wetu atawasiliana nawe hivi punde.'
              : 'One of our agents will contact you shortly.';
          await this.whatsappService.sendTextMessage({ to: phone, text: resp });
          return { response: resp, chatId: null };
        }
        // Show unidentified menu if they just say "hi"
        if (isGreeting) {
          const menu = this.mainMenu.getUnidentifiedMenu(language);
          await this.whatsappService.sendInteractiveMessage({
            to: phone,
            interactive: menu,
          });
          return { response: 'Showing Unidentified Menu', chatId: null };
        }
      }

      const twoHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
      const lastChat = await this.prisma.chatHistory.findFirst({
        where: {
          userId: sender.id === 'unidentified' ? null : sender.id,
          deletedAt: null,
          updatedAt: { gte: twoHoursAgo },
        },
        orderBy: { updatedAt: 'desc' },
      });

      return await tenantContext.run(
        {
          companyId: lastChat?.companyId || sender.companyId || undefined,
          userId: sender.id,
          role: sender.role,
          isSuperAdmin: sender.role === UserRole.SUPER_ADMIN,
          chatId: lastChat?.id || undefined,
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
            try {
              downloadedMedia = await this.whatsappService.downloadMedia(
                mediaId,
                companyId,
              );
              // Proactive feedback for audio
              const feedbackMsg =
                lang === 'sw'
                  ? '🎤 Nimepokea ujumbe wako wa sauti. Hebu niusikilize...'
                  : '🎤 Received your voice note. Let me listen to it...';
              await this.whatsappService.sendTextMessage({
                companyId,
                to: phone,
                text: feedbackMsg,
              });

              const transcript = await this.transcribeAudio(
                downloadedMedia.data,
                downloadedMedia.mimeType,
                language || undefined,
              );
              if (!transcript || transcript.trim() === '') {
                const failMsg =
                  language === 'sw'
                    ? 'Samahani, sikuweza kusikia vizuri. Tafadhali rudia au andika ujumbe wako.'
                    : 'Sorry, I could not understand the voice note. Please try again or type your message.';
                await this.whatsappService.sendTextMessage({
                  companyId,
                  to: phone,
                  text: failMsg,
                });
                return { response: failMsg, chatId: lastChat?.id || null };
              }

              // We DEFER the "✍️ I heard" echo until after classification
              // to provide a combined "Actionable Echo"
              text = transcript;
              const detectedLang = detectLanguage(transcript || '');
              if (detectedLang !== 'mixed') {
                language = detectedLang as any;
              }
            } catch (e) {
              this.logger.error(`Audio transcription failed: ${e.message}`);
            }
          }

          // Resolve chatId early for logging
          let chatId = lastChat?.id;

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

          const safeText = text?.trim() || '';
          const isNumericSelection =
            safeText && /^\d+[\.\?\!\s]*$/.test(safeText);
          const isUuidSelection =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              safeText,
            );

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
            const result = await this.aiService.executePlan(sender.id, phone);
            await sendAndLog(result.response);
            return result;
          }

          if (safeText === 'plan_cancel') {
            const session = await this.cacheManager.get<any>(
              `ai_session:${uid}`,
            );
            if (session) {
              delete session.pendingConfirmation;
              await this.cacheManager.set(`ai_session:${uid}`, session);
            }
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
                emoji: '⏳',
              });
              await this.quorumBridge.addApproval(actionId, sender.id);

              const successMsg =
                lang === 'sw'
                  ? '✅ Uidhinishaji umekamilika! Naweza kuendelea na hatua hii sasa.'
                  : '✅ Authorization successful! I can now proceed with the action.';

              await sendAndLog(successMsg, undefined, {
                type: 'button',
                body: { text: successMsg },
                action: {
                  buttons: [
                    {
                      type: 'reply',
                      reply: {
                        id: 'execute_plan',
                        title: lang === 'sw' ? 'Endelea sasa' : 'Proceed Now',
                      },
                    },
                  ],
                },
              });
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
              
              if (activeRecovery.action === 'execute_tool') {
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
              
              return await this.handleIncomingWhatsapp(
                phone,
                activeRecovery.originalText,
                undefined,
                undefined,
                `retry_${Date.now()}`
              );
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
                      : {}),
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
            /\b(add|create|record|update|delete|register|import|assign|mark|onboard)\b/i.test(
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
            /house\s*(?:no\.?|number|#)?\s*\d+|house\s*\d+|unit\s*[a-z0-9]+|nyumba\s*\d+/i.test(
              effectiveText,
            );
          const looksLikeInterest =
            /interested|intrested|available|vacant|for\s+rent|renting|to\s+rent|view(ing)?|visit|schedule|nataka\s+kupanga|ipo\s*waz/i.test(
              effectiveText.toLowerCase(),
            );

          // Dynamic disambiguation: avoid robotic "write intent" confirmations on ambiguous property messages
          if (
            looksLikePropertyRef &&
            (!explicitWrite || confidence < 0.75) &&
            (isWriteAction ||
              classification.intent === 'general_query' ||
              classification.intent === 'unknown')
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
            });

            const ask =
              lang === 'sw'
                ? looksLikeInterest
                  ? 'Unataka kufanya nini na nyumba/kitengo hiki?'
                  : 'Unamaanisha nini kuhusu nyumba/kitengo hiki?'
                : looksLikeInterest
                  ? 'What would you like to do with this house/unit?'
                  : 'What do you mean about this house/unit?';

            const options =
              lang === 'sw'
                ? [
                    {
                      key: 'details',
                      label: 'Maelezo',
                      action: 'intent_choose:get_property_details',
                    },
                    {
                      key: 'vacancy',
                      label: 'Upatikanaji',
                      action: 'intent_choose:check_vacancy',
                    },
                    {
                      key: 'tenant',
                      label: 'Sajili mpangaji',
                      action: 'intent_choose:add_tenant',
                    },
                  ]
                : [
                    {
                      key: 'details',
                      label: 'View details',
                      action: 'intent_choose:get_property_details',
                    },
                    {
                      key: 'vacancy',
                      label: 'Check availability',
                      action: 'intent_choose:check_vacancy',
                    },
                    {
                      key: 'tenant',
                      label: 'Register tenant',
                      action: 'intent_choose:add_tenant',
                    },
                  ];

            const interactive = this.whatsappFormatter.buildButtonMessage(
              ask,
              options,
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
            const intentDesc =
              humanIntents[classification.intent] ||
              (lang === 'sw'
                ? 'Kutekeleza ombi lako'
                : 'Processing your request');
            const label =
              !explicitWrite && confidence < 0.75
                ? lang === 'sw'
                  ? '📝 Inawezekana unamaanisha'
                  : '📝 Possible action'
                : lang === 'sw'
                  ? '📝 Kusudi'
                  : '📝 Intent';

            const echoBody =
              lang === 'sw'
                ? `🎤 Nimepokea ujumbe wako.\n✍️ Nilichosikia: "${effectiveText}"\n${label}: ${intentDesc}`
                : `🎤 Received your request.\n✍️ I heard: "${effectiveText}"\n${label}: ${intentDesc}`;

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
            });
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

            if (
              !result.interactive &&
              (!result.metadata?.clarificationNeeded || responseLooksLikeSelection)
            ) {
              if (result.vcSummary) {
                result.interactive = this.crudButtons.buildCrudButtons(
                  result.vcSummary,
                  language || 'en',
                );
              } else {
                const justCachedList: any = await this.cacheManager.get(
                  `list:${uid}`,
                );
                if (
                  (cameFromListTool && responseLooksLikeSelection) ||
                  (justCachedList &&
                    justCachedList.items &&
                    justCachedList.items.length > 0)
                ) {
                  // If we didn't explicitly detect a list tool but have a cached list and selection text, show it.
                  if (!justCachedList && (cameFromListTool || responseLooksLikeSelection)) {
                      this.logger.warn(`[WhatsApp] Selection required but no list found in cache for ${uid}`);
                  }
                  
                  if (
                    justCachedList &&
                    justCachedList.items &&
                    justCachedList.items.length > 0
                  ) {
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
              }
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
      const recovery = this.recovery.buildInteractiveErrorRecovery(
        'default',
        err,
        { userId },
        (language as any) || 'en',
      );
      
      // Clear stale lists and set recovery context
      await this.cacheManager.del(`list:${uid}`);
      await this.cacheManager.set(`recovery:${uid}`, {
        action: 'execute_tool', // This needs to be smarter, but for now we assume tool failure
        // We need to capture what just failed. This is tricky given the current orchestrator structure.
        // For now, let's at least clear the list so '1' doesn't go to companies.
      }, 300 * 1000);

      await this.cacheManager.set(
        `fail_reason:${recovery.errorId}`,
        err.message,
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
      return { response: recovery.text, chatId: null };
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
            status: 'OPEN',
            deletedAt: null,
          },
          _sum: { amount: true },
        });
        context.balanceDue = unpaidInvoices._sum.amount || 0;
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
