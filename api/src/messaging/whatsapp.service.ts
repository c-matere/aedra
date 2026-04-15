import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SenderType } from '@prisma/client';
import { UserRole } from '../auth/roles.enum';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { withRetry } from '../common/utils/retry';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async parseMetaResponse(response: Response): Promise<any> {
    const raw = await response.text().catch(() => '');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return { raw };
    }
  }

  private formatMetaApiError(result: any, status: number): string {
    const metaMsg =
      result?.error?.message ||
      result?.message ||
      (typeof result === 'string' ? result : null) ||
      (result?.raw ? String(result.raw).slice(0, 500) : null);

    const metaCode =
      result?.error?.code ||
      result?.error?.error_subcode ||
      result?.code ||
      result?.status;

    const parts = [`Meta API request failed (HTTP ${status})`];
    if (metaCode) parts.push(`code=${metaCode}`);
    if (metaMsg) parts.push(String(metaMsg));
    return parts.join(': ');
  }

  private getDefaultTemplateLanguageCode(): string {
    return (
      (process.env.WA_DEFAULT_TEMPLATE_LANGUAGE_CODE || 'en_US').trim() ||
      'en_US'
    );
  }

  private normalizeTemplateLanguageCode(languageCode?: string): string {
    const raw = (languageCode || '').trim();
    if (!raw) return this.getDefaultTemplateLanguageCode();

    // Accept both `en-US` and `en_US`.
    const normalized = raw.replace('-', '_');
    const lower = normalized.toLowerCase();

    // App-level language codes commonly used across the codebase.
    if (lower === 'en') return 'en'; // Stop forcing en_US
    if (lower === 'sw') return 'sw';

    return normalized;
  }

  private getTemplateLanguageAttempts(primary: string): string[] {
    const fallbacksRaw = (
      process.env.WA_TEMPLATE_LANGUAGE_FALLBACKS || ''
    ).trim();
    const fallbacks = fallbacksRaw
      ? fallbacksRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const attempts = [
      primary,
      ...fallbacks.map((code) => this.normalizeTemplateLanguageCode(code)),
      this.getDefaultTemplateLanguageCode(),
    ];

    // Keep order, remove duplicates.
    const seen = new Set<string>();
    return attempts.filter((code) => {
      if (!code) return false;
      if (seen.has(code)) return false;
      seen.add(code);
      return true;
    });
  }

  /**
   * Identify a person by their phone number across Users, Landlords, and Tenants.
   */
  async identifySenderByPhone(phone: string): Promise<AuthenticatedUser> {
    const rawDigits = phone.replace(/\D/g, ''); // 254712345678
    const last9 = rawDigits.slice(-9); // 712345678

    const possibleFormats = [
      rawDigits, // 254712345678
      `+${rawDigits}`, // +254712345678
      `0${last9}`, // 0712345678
      last9, // 712345678
    ];

    this.logger.log(
      `Identifying sender for phone: ${phone} (last9: ${last9}). Checking formats: ${JSON.stringify(possibleFormats)}`,
    );

    // 1. Check Users (Admins/Staff)
    const user = await this.prisma.user.findFirst({
      where: {
        phone: { in: possibleFormats },
        deletedAt: null,
      },
      select: { id: true, companyId: true, role: true },
    });
    if (user) {
      this.logger.log(
        `Found User: ${user.id} (Role: ${user.role}, Company: ${user.companyId || 'NONE'})`,
      );
      return user as any as AuthenticatedUser;
    }

    // 2. Check Landlords
    const landlord = await this.prisma.landlord.findFirst({
      where: {
        phone: { in: possibleFormats },
        deletedAt: null,
      },
      select: { id: true, companyId: true },
    });
    if (landlord) {
      this.logger.log(
        `Found Landlord: ${landlord.id} (Company: ${landlord.companyId})`,
      );
      return {
        id: landlord.id,
        companyId: landlord.companyId,
        role: UserRole.LANDLORD,
      };
    }

    // 3. Check Tenants
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        phone: { in: possibleFormats },
        deletedAt: null,
      },
      select: { id: true, companyId: true },
    });
    if (tenant) {
      this.logger.log(
        `Found Tenant: ${tenant.id} (Company: ${tenant.companyId})`,
      );
      return {
        id: tenant.id,
        companyId: tenant.companyId,
        role: UserRole.TENANT,
      };
    }

    // 4. Unidentified
    this.logger.warn(`Sender ${phone} NOT IDENTIFIED.`);
    return {
      id: 'unidentified',
      role: UserRole.UNIDENTIFIED,
    };
  }

  /**
   * Get or create a WhatsAppProfile for a phone number.
   */
  async getWhatsAppProfile(phone: string) {
    let profile = await this.prisma.whatsAppProfile.findUnique({
      where: { phone },
    });

    if (!profile) {
      profile = await this.prisma.whatsAppProfile.create({
        data: { phone },
      });
    }

    return profile;
  }

  /**
   * Update WhatsAppProfile state.
   */
  async updateWhatsAppProfile(
    phone: string,
    data: Partial<{ language: string; onboarded: boolean }>,
  ) {
    return this.prisma.whatsAppProfile.update({
      where: { phone },
      data,
    });
  }

  /**
   * Update language for a specific role (Tenant/Landlord/User).
   */
  async updateLanguage(id: string, role: UserRole, language: string) {
    if (role === UserRole.TENANT) {
      return this.prisma.tenant.update({ where: { id }, data: { language } });
    } else if (role === UserRole.LANDLORD) {
      return this.prisma.landlord.update({ where: { id }, data: { language } });
    } else if (role !== UserRole.UNIDENTIFIED) {
      return this.prisma.user.update({ where: { id }, data: { language } });
    }
  }

  /**
   * Send a template message to a phone number.
   * Logic:
   * 1. Try to fetch company WhatsApp credentials.
   * 2. Fallback to system credentials if company ones are missing.
   * 3. Record the message in WhatsAppLog.
   */
  async sendMessage(params: {
    companyId?: string;
    to: string;
    templateName: string;
    languageCode?: string;
    components?: any[];
  }) {
    const {
      companyId,
      to,
      templateName,
      languageCode,
      components = [],
    } = params;

    let accessToken = process.env.META_ACCESS_TOKEN;
    let phoneNumberId = process.env.META_PHONE_NUMBER_ID;
    let senderType: SenderType = SenderType.SYSTEM;

    if (companyId) {
      const company: any = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: {
          waAccessToken: true,
          waPhoneNumberId: true,
        } as any,
      });

      if (company?.waAccessToken && company?.waPhoneNumberId) {
        accessToken = company.waAccessToken;
        phoneNumberId = company.waPhoneNumberId;
        senderType = SenderType.COMPANY;
      }
    }

    if (!accessToken || !phoneNumberId) {
      this.logger.error(
        `WhatsApp credentials missing (System fallback failed)`,
      );
      throw new InternalServerErrorException(
        'WhatsApp messaging is not configured.',
      );
    }

    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      to: (to || '').replace('+', ''),
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: this.normalizeTemplateLanguageCode(languageCode),
        },
        components,
      },
    };

    try {
      const languageAttempts = this.getTemplateLanguageAttempts(
        payload.template.language.code,
      );
      let response: Response | null = null;
      let result: any = null;

      for (const code of languageAttempts) {
        payload.template.language.code = code;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        response = await withRetry(() =>
          fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
              Connection: 'keep-alive',
            },
            body: JSON.stringify(payload),
            signal: controller.signal as any,
          }),
        ).finally(() => clearTimeout(timeoutId));

        result = await this.parseMetaResponse(response);

        if (response.ok) break;
        // 132001: template exists but not for this language translation
        if (result?.error?.code === 132001) continue;
        break;
      }

      const status = response?.ok ? 'SENT' : 'FAILED';
      const metaMessageId = result?.messages?.[0]?.id;

      // Log the message
      await this.prisma.whatsAppLog.create({
        data: {
          companyId,
          to,
          templateName,
          senderType,
          status,
          metaMessageId: metaMessageId || null,
        },
      });

      if (!response?.ok) {
        this.logger.error(`Meta API error: ${JSON.stringify(result)}`);
        throw new InternalServerErrorException(
          this.formatMetaApiError(result, response?.status || 0),
        );
      }

      return { ...result, senderType };
    } catch (error) {
      const isNetwork =
        error.message?.includes('fetch failed') ||
        error.code === 'UND_ERR_CONNECT_TIMEOUT';
      this.logger.error(
        `[WhatsApp] Failed to send template message: ${error.message}${isNetwork ? ' (Network/Meta API unreachable)' : ''}`,
      );
      throw error;
    }
  }

  /**
   * Send an interactive message (List, Buttons, Flows).
   */
  async sendInteractiveMessage(params: {
    companyId?: string;
    to: string;
    interactive: any;
  }) {
    const { companyId, to, interactive } = params;

    let accessToken = process.env.META_ACCESS_TOKEN;
    let phoneNumberId = process.env.META_PHONE_NUMBER_ID;
    let senderType: SenderType = SenderType.SYSTEM;

    if (companyId) {
      const company: any = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: {
          waAccessToken: true,
          waPhoneNumberId: true,
        } as any,
      });

      if (company?.waAccessToken && company?.waPhoneNumberId) {
        accessToken = company.waAccessToken;
        phoneNumberId = company.waPhoneNumberId;
        senderType = SenderType.COMPANY;
      }
    }

    if (!accessToken || !phoneNumberId) {
      throw new InternalServerErrorException(
        'WhatsApp messaging is not configured.',
      );
    }

    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: (to || '').replace('+', ''),
      type: 'interactive',
      interactive,
    };

    if (!payload.to) {
      throw new BadRequestException('Recipient phone number is missing.');
    }
    if (!payload.interactive) {
      throw new BadRequestException('Interactive payload is missing.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await withRetry(() =>
        fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            Connection: 'keep-alive',
          },
          body: JSON.stringify(payload),
          signal: controller.signal as any,
        }),
      ).finally(() => clearTimeout(timeoutId));

      const result = await this.parseMetaResponse(response);
      const status = response.ok ? 'SENT' : 'FAILED';
      const metaMessageId = result?.messages?.[0]?.id;

      // Log the message
      await this.prisma.whatsAppLog.create({
        data: {
          companyId,
          to,
          templateName: `INTERACTIVE_${String(payload.interactive?.type || 'UNKNOWN').toUpperCase()}`,
          senderType,
          status,
          metaMessageId: metaMessageId || null,
        },
      });

      if (!response.ok) {
        this.logger.error(
          `Meta API interactive error: ${JSON.stringify(result)}`,
        );
        throw new InternalServerErrorException(
          this.formatMetaApiError(result, response.status),
        );
      }

      return { ...result, senderType };
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp interactive: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Send an interactive message with buttons.
   */
  async sendInteractiveButtons(params: {
    companyId?: string;
    to: string;
    text: string;
    buttons: { id: string; title: string }[];
  }) {
    const { companyId, to, text, buttons } = params;
    return await this.sendInteractiveMessage({
      companyId,
      to,
      interactive: {
        type: 'button',
        body: { text },
        action: {
          buttons: buttons.map((b) => ({
            type: 'reply',
            reply: { id: b.id, title: b.title },
          })),
        },
      },
    });
  }

  /**
   * Send a reaction to a specific message.
   */
  async sendReaction(params: {
    companyId?: string;
    to: string;
    messageId: string;
    emoji: string;
  }) {
    const { companyId, to, messageId, emoji } = params;

    let accessToken = process.env.META_ACCESS_TOKEN;
    let phoneNumberId = process.env.META_PHONE_NUMBER_ID;

    if (companyId) {
      const company: any = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { waAccessToken: true, waPhoneNumberId: true } as any,
      });
      if (company?.waAccessToken && company?.waPhoneNumberId) {
        accessToken = company.waAccessToken;
        phoneNumberId = company.waPhoneNumberId;
      }
    }

    if (!accessToken || !phoneNumberId) return;

    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace('+', ''),
      type: 'reaction',
      reaction: {
        message_id: messageId,
        emoji: emoji,
      },
    };

    try {
      await withRetry(() =>
        fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        }),
      );
    } catch (e) {
      this.logger.warn(`Failed to send reaction: ${e.message}`);
    }
  }

  /**
   * Send a request for the user to share their location.
   */
  async sendLocationRequest(params: {
    companyId?: string;
    to: string;
    text: string;
  }) {
    const { companyId, to, text } = params;
    return this.sendInteractiveMessage({
      companyId,
      to,
      interactive: {
        type: 'address_message',
        body: { text },
        action: {
          name: 'send_location',
        },
      },
    });
  }

  /**
   * Send a free-text message (only works if user messaged in the last 24h).
   */
  async sendTextMessage(params: {
    companyId?: string;
    to: string;
    text: string;
  }) {
    const { companyId, to, text } = params;

    let accessToken = process.env.META_ACCESS_TOKEN;
    let phoneNumberId = process.env.META_PHONE_NUMBER_ID;
    let senderType: SenderType = SenderType.SYSTEM;

    if (companyId) {
      const company: any = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: {
          waAccessToken: true,
          waPhoneNumberId: true,
        } as any,
      });

      if (company?.waAccessToken && company?.waPhoneNumberId) {
        accessToken = company.waAccessToken;
        phoneNumberId = company.waPhoneNumberId;
        senderType = SenderType.COMPANY;
      }
    }

    if (!accessToken || !phoneNumberId) {
      throw new InternalServerErrorException(
        'WhatsApp messaging is not configured.',
      );
    }

    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: (to || '').replace('+', ''),
      type: 'text',
      text: { body: text },
    };

    if (!payload.to) {
      throw new BadRequestException('Recipient phone number is missing.');
    }
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new BadRequestException('Text body is missing.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const response = await withRetry(() =>
        fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            Connection: 'keep-alive',
          },
          body: JSON.stringify(payload),
          signal: controller.signal as any,
        }),
      ).finally(() => clearTimeout(timeoutId));

      const result = await this.parseMetaResponse(response);
      const status = response.ok ? 'SENT' : 'FAILED';
      const metaMessageId = result?.messages?.[0]?.id;

      // Log the message
      await this.prisma.whatsAppLog.create({
        data: {
          companyId,
          to,
          templateName: 'FREE_TEXT',
          senderType,
          status,
          metaMessageId: metaMessageId || null,
        },
      });

      if (!response.ok) {
        this.logger.error(`Meta API error: ${JSON.stringify(result)}`);
        throw new InternalServerErrorException(
          this.formatMetaApiError(result, response.status),
        );
      }

      return { ...result, senderType };
    } catch (error) {
      const isNetwork =
        error.message?.includes('fetch failed') ||
        error.code === 'UND_ERR_CONNECT_TIMEOUT';
      this.logger.error(
        `[WhatsApp] Failed to send text message: ${error.message}${isNetwork ? ' (Network/Meta API unreachable)' : ''}`,
      );
      throw error;
    }
  }

  /**
   * Send a document/file message (PDF, CSV, etc).
   */
  async sendDocument(params: {
    companyId?: string;
    to: string;
    url: string;
    fileName: string;
    caption?: string;
  }) {
    const { companyId, to, url, fileName, caption } = params;

    let accessToken = process.env.META_ACCESS_TOKEN;
    let phoneNumberId = process.env.META_PHONE_NUMBER_ID;
    let senderType: SenderType = SenderType.SYSTEM;

    if (companyId) {
      const company: any = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: {
          waAccessToken: true,
          waPhoneNumberId: true,
        } as any,
      });

      if (company?.waAccessToken && company?.waPhoneNumberId) {
        accessToken = company.waAccessToken;
        phoneNumberId = company.waPhoneNumberId;
        senderType = SenderType.COMPANY;
      }
    }

    if (!accessToken || !phoneNumberId) {
      throw new InternalServerErrorException(
        'WhatsApp messaging is not configured.',
      );
    }

    const metaUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: (to || '').replace('+', ''),
      type: 'document',
      document: {
        link: url,
        filename: fileName,
        ...(caption ? { caption } : {}),
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await withRetry(() =>
        fetch(metaUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            Connection: 'keep-alive',
          },
          body: JSON.stringify(payload),
          signal: controller.signal as any,
        }),
      ).finally(() => clearTimeout(timeoutId));

      const result = await this.parseMetaResponse(response);
      const status = response.ok ? 'SENT' : 'FAILED';
      const metaMessageId = result?.messages?.[0]?.id;

      // Log the message
      await this.prisma.whatsAppLog.create({
        data: {
          companyId,
          to,
          templateName: 'DOCUMENT',
          senderType,
          status,
          metaMessageId: metaMessageId || null,
        },
      });

      if (!response.ok) {
        this.logger.error(`Meta API document error: ${JSON.stringify(result)}`);
        throw new InternalServerErrorException(
          this.formatMetaApiError(result, response.status),
        );
      }

      return { ...result, senderType };
    } catch (error) {
      this.logger.error(`Failed to send WhatsApp document: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send a template message with a document header.
   */
  async sendDocumentTemplate(params: {
    companyId?: string;
    to: string;
    templateName: string;
    languageCode?: string;
    url: string;
    fileName: string;
    components?: any[];
  }) {
    const {
      companyId,
      to,
      templateName,
      languageCode,
      url,
      fileName,
      components = [],
    } = params;

    let accessToken = process.env.META_ACCESS_TOKEN;
    let phoneNumberId = process.env.META_PHONE_NUMBER_ID;
    let senderType: SenderType = SenderType.SYSTEM;

    if (companyId) {
      const company: any = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { waAccessToken: true, waPhoneNumberId: true } as any,
      });
      if (company?.waAccessToken && company?.waPhoneNumberId) {
        accessToken = company.waAccessToken;
        phoneNumberId = company.waPhoneNumberId;
        senderType = SenderType.COMPANY;
      }
    }

    if (!accessToken || !phoneNumberId) {
      throw new InternalServerErrorException(
        'WhatsApp messaging is not configured.',
      );
    }

    const metaUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    // Ensure header components are added
    const finalComponents = [
      {
        type: 'header',
        parameters: [
          {
            type: 'document',
            document: { link: url, filename: fileName },
          },
        ],
      },
      ...components,
    ];

    const payload = {
      messaging_product: 'whatsapp',
      to: (to || '').replace('+', ''),
      type: 'template',
      template: {
        name: templateName,
        language: { code: this.normalizeTemplateLanguageCode(languageCode) },
        components: finalComponents,
      },
    };

    try {
      const languageAttempts = this.getTemplateLanguageAttempts(
        payload.template.language.code,
      );
      let response: Response | null = null;
      let result: any = null;

      for (const code of languageAttempts) {
        payload.template.language.code = code;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        response = await withRetry(() =>
          fetch(metaUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
              Connection: 'keep-alive',
            },
            body: JSON.stringify(payload),
            signal: controller.signal as any,
          }),
        ).finally(() => clearTimeout(timeoutId));

        result = await response.json();

        if (response.ok) break;
        if (result?.error?.code === 132001) continue;
        break;
      }

      const status = response?.ok ? 'SENT' : 'FAILED';
      const metaMessageId = result?.messages?.[0]?.id;

      await this.prisma.whatsAppLog.create({
        data: {
          companyId,
          to,
          templateName: `${templateName}_DOC`,
          senderType,
          status,
          metaMessageId: metaMessageId || null,
        },
      });

      if (!response?.ok) {
        this.logger.error(
          `Meta API document template error: ${JSON.stringify(result)}`,
        );
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp document template: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Send an OTP code using a template.
   */
  async sendOtp(to: string, code: string, companyId?: string) {
    return this.sendMessage({
      companyId,
      to,
      templateName: 'otp_verification',
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: code }],
        },
        {
          type: 'button',
          index: '0',
          sub_type: 'url',
          parameters: [{ type: 'text', text: code }],
        },
      ],
    });
  }

  /**
   * Send a rent reminder using a template.
   */
  async sendRentReminder(params: {
    to: string;
    tenantName: string;
    amountDue: number;
    unitNumber: string;
    dueDate: string;
    isFirm?: boolean;
    companyId?: string;
  }) {
    const {
      to,
      tenantName,
      amountDue,
      unitNumber,
      dueDate,
      isFirm = false,
      companyId,
    } = params;
    return this.sendMessage({
      companyId,
      to,
      templateName: isFirm ? 'rent_reminder_firm' : 'rent_reminder',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: tenantName },
            { type: 'text', text: String(amountDue.toLocaleString()) },
            { type: 'text', text: unitNumber },
            { type: 'text', text: dueDate },
          ],
        },
      ],
    });
  }

  /**
   * Send a payment confirmation using a template.
   */
  async sendPaymentConfirmation(params: {
    to: string;
    tenantName: string;
    amount: number;
    unitNumber: string;
    newBalance?: number;
    companyId?: string;
  }) {
    const {
      to,
      tenantName,
      amount,
      unitNumber,
      newBalance = 0,
      companyId,
    } = params;
    return this.sendMessage({
      companyId,
      to,
      templateName: 'payment_receipt',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: String(amount.toLocaleString()) },
            { type: 'text', text: unitNumber },
            { type: 'text', text: new Date().toLocaleDateString() },
            { type: 'text', text: String((newBalance || 0).toLocaleString()) },
            { type: 'text', text: tenantName },
          ],
        },
      ],
    });
  }

  /**
   * Send an invoice notification using a template.
   */
  async sendInvoiceNotice(params: {
    to: string;
    tenantName: string;
    amount: number;
    description: string;
    unitNumber: string;
    dueDate: string;
    companyId?: string;
  }) {
    const {
      to,
      tenantName,
      amount,
      description,
      unitNumber,
      dueDate,
      companyId,
    } = params;

    return this.sendMessage({
      companyId,
      to,
      templateName: 'invoice_notice',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: tenantName },
            { type: 'text', text: description },
            { type: 'text', text: String(amount.toLocaleString()) },
            { type: 'text', text: unitNumber },
            { type: 'text', text: dueDate },
          ],
        },
      ],
    });
  }

  /**
   * Verify Meta Webhook subscription.
   */
  async verifyWebhook(
    companyId: string,
    query: {
      'hub.mode': string;
      'hub.verify_token': string;
      'hub.challenge': string;
    },
  ) {
    let expectedToken = process.env.META_VERIFY_TOKEN;

    if (companyId !== 'system') {
      const company: any = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { waVerifyToken: true } as any,
      });

      if (!company) {
        throw new NotFoundException('Company not found');
      }

      expectedToken = company.waVerifyToken;
    }

    if (
      query['hub.mode'] === 'subscribe' &&
      query['hub.verify_token'] === expectedToken
    ) {
      this.logger.log(`Webhook verified successfully for ${companyId}`);
      return query['hub.challenge'];
    }

    this.logger.error(
      `Webhook verification failed for ${companyId}. Expected: ${expectedToken}, Got: ${query['hub.verify_token']}`,
    );
    throw new InternalServerErrorException('Verification failed');
  }

  /**
   * Handle incoming data from Meta Webhook.
   */
  async handleWebhook(body: any) {
    // Only log if there's a real message — status callbacks are silent
    if (body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      this.logger.log(
        `[Webhook] Incoming message from ${body.entry[0].changes[0].value.messages[0].from}`,
      );
    }

    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (message?.from) {
      const sender = await this.identifySenderByPhone(message.from);
      this.logger.log(
        `Incoming WhatsApp from ${message.from} identified as ${sender.role} (Company: ${sender.companyId || 'N/A'})`,
      );

      // In next steps, we would trigger AiService.chat with this synthetic sender context
    }

    return { status: 'ok' };
  }

  /**
   * Download media from Meta (Voice notes, images, documents).
   */
  async downloadMedia(
    mediaId: string,
    companyId?: string,
  ): Promise<{ data: string; mimeType: string }> {
    let accessToken = process.env.META_ACCESS_TOKEN;

    if (companyId) {
      const company: any = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { waAccessToken: true } as any,
      });
      if (company?.waAccessToken) {
        accessToken = company.waAccessToken;
      }
    }

    if (!accessToken) {
      throw new InternalServerErrorException('WhatsApp access token missing.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s for media

    try {
      // 1. Get media URL
      const url = `https://graph.facebook.com/v21.0/${mediaId}`;
      const res = await withRetry(() =>
        fetch(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Connection: 'keep-alive',
          },
          signal: controller.signal as any,
        }),
      );

      if (!res.ok) {
        const error = await res.json();
        this.logger.error(`Failed to get media URL: ${JSON.stringify(error)}`);
        throw new InternalServerErrorException(
          'Failed to fetch media metadata from Meta.',
        );
      }

      const { url: downloadUrl, mime_type: mimeType } = await res.json();

      // 2. Download actual content
      const mediaRes = await withRetry(() =>
        fetch(downloadUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Connection: 'keep-alive',
          },
          signal: controller.signal as any,
        }),
      );

      if (!mediaRes.ok) {
        throw new InternalServerErrorException(
          'Failed to download media content from Meta.',
        );
      }

      const buffer = await mediaRes.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');

      return { data: base64, mimeType };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
