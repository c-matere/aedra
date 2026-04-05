import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  UseGuards,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/roles.enum';
import { AiWhatsappOrchestratorService } from '../ai/ai-whatsapp-orchestrator.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ErrorRecoveryService } from '../ai/error-recovery.service';
import { SkipThrottle } from '@nestjs/throttler';

@Controller(['messaging/whatsapp', ''])
export class WhatsappController {
  constructor(
    private readonly whatsappService: WhatsappService,
    @Inject(forwardRef(() => AiWhatsappOrchestratorService))
    private readonly orchestrator: AiWhatsappOrchestratorService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly recovery: ErrorRecoveryService,
  ) {}

  /**
   * Endpoint for Meta to verify webhooks.
   * Path should be unique per company or use a query param.
   */
  @Get('webhook/:companyId')
  async verify(@Param('companyId') companyId: string, @Query() query: any) {
    return this.whatsappService.verifyWebhook(companyId, query);
  }

  /**
   * Endpoint for Meta to send message updates.
   * Supports /webhook and /webhook/:companyId
   */
  @SkipThrottle()
  @Post(['webhook', 'webhook/:companyId'])
  async handleIncoming(
    @Body() body: any,
    @Param('companyId') companyId?: string,
  ) {
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    // Only log when a real user message arrives (skip status callbacks)
    if (message?.from) {
      console.log(`[WhatsApp] ▶ Incoming from ${message.from} type=${message.type || 'text'} wamid=${message.id}`);
      const messageId = message.id;
      if (messageId) {
        const cacheKey = `wa_msg_${messageId}`;
        const isProcessing = await this.cacheManager.get(cacheKey);
        if (isProcessing) {
          console.log(`[WhatsApp] Duplicate message (wamid: ${messageId}), skipping.`);
          return { status: 'duplicate' };
        }
        // Mark as processing for 5 minutes (retries usually happen within seconds/minutes)
        await this.cacheManager.set(cacheKey, true, 300000);
      }

      const type = message?.type;
      let text = message?.text?.body;
      let mediaId = null;
      let mimeType = null;

      if (type === 'interactive') {
        const interactive = message?.interactive;
        const interactiveType = interactive?.type;
        if (interactiveType === 'list_reply') {
          text = interactive?.list_reply?.id;
        } else if (interactiveType === 'button_reply') {
          text = interactive?.button_reply?.id;
        } else {
          // Meta sometimes sends "interactive" messages with errors but without an interactive payload.
          // Treat these as non-user actions and safely ignore.
          if (Array.isArray(message?.errors) && message.errors.length > 0) {
            console.warn(
              `[WhatsappController] Ignoring interactive webhook error payload: ${JSON.stringify(
                message.errors,
              ).substring(0, 200)}`,
            );
          } else {
            console.warn(
              `[WhatsappController] Unsupported interactive payload: ${JSON.stringify(
                message,
              ).substring(0, 200)}`,
            );
          }
        }
      } else if (type === 'text') {
        text = message.text.body;
      } else if (message[type]) {
        const media = message[type];
        text = media.caption;
        mediaId = media.id;
        mimeType = media.mime_type;
      }

      if (text || mediaId) {
        // Run AI processing in background to return 200 OK to Meta immediately
        // This prevents Meta from retrying due to timeouts (e.g. slow report generation)
        this.orchestrator
          .handleIncomingWhatsapp(
            message.from,
            text,
            mediaId,
            mimeType,
            messageId,
          )
          .catch(async (error: any) => {
            console.error(
              `[WhatsappController] Background process error:`,
              error,
            );
            try {
              const recoveryMsg = this.recovery.buildErrorRecovery(
                'default',
                error,
                {},
              );
              await this.whatsappService.sendTextMessage({
                to: message.from,
                text: recoveryMsg,
              });
            } catch (sendError) {
              console.error(
                `[WhatsappController] Failed to send recovery message:`,
                sendError,
              );
            }
          });

        return { status: 'accepted', messageId };
      }
    }

    return this.whatsappService.handleWebhook(body);
  }

  /**
   * Internal test endpoint (Admin only).
   */
  @Post('test-send')
  @UseGuards(RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  async testSend(
    @Body()
    body: {
      companyId: string;
      to: string;
      templateName: string;
      components?: any[];
    },
  ) {
    return this.whatsappService.sendMessage(body);
  }
}
