import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SenderType } from '@prisma/client';
import { withRetry } from '../common/utils/retry';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve credentials for SMS Leopard.
   * Logic: Check company-specific settings, fallback to global environment variables.
   */
  private async resolveCredentials(companyId?: string) {
    let apiKey = process.env.SMS_LEOPARD_API_KEY;
    let apiSecret = process.env.SMS_LEOPARD_API_SECRET;
    let source = process.env.SMS_LEOPARD_SOURCE || 'SMSLeopard';
    let senderType: SenderType = SenderType.SYSTEM;

    if (companyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: {
          smsLeopardApiKey: true,
          smsLeopardApiSecret: true,
          smsLeopardSource: true,
        },
      });

      if (company?.smsLeopardApiKey && company?.smsLeopardApiSecret) {
        apiKey = company.smsLeopardApiKey;
        apiSecret = company.smsLeopardApiSecret;
        source = company.smsLeopardSource || source;
        senderType = SenderType.COMPANY;
      } else {
        this.logger.log(
          `[SMS] No credentials found for company ${companyId}. Falling back to global credentials.`,
        );
      }
    }

    if (!apiKey || !apiSecret) {
      this.logger.error(`SMS Leopard credentials missing (System fallback failed)`);
      throw new InternalServerErrorException(
        'SMS messaging is not configured.',
      );
    }

    return { apiKey, apiSecret, source, senderType };
  }

  /**
   * Send an SMS via SMS Leopard API.
   */
  async sendSms(params: {
    to: string;
    message: string;
    companyId?: string;
  }) {
    const { to, message, companyId } = params;
    const { apiKey, apiSecret, source, senderType } = await this.resolveCredentials(companyId);

    const url = 'https://api.smsleopard.com/v1/sms/send';
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

    const payload = {
      source,
      message,
      destination: [
        {
          number: to.startsWith('+') ? to : `+${to.replace(/\s+/g, '')}`,
        },
      ],
    };

    try {
      const response = await withRetry(() =>
        fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${auth}`,
          },
          body: JSON.stringify(payload),
        }),
      );

      const result = await response.json();
      const status = response.ok ? 'SENT' : 'FAILED';
      
      // We expect the API to return something like { status: 'success', data: { id: '...' } }
      // or similar based on their docs.
      const externalId = result?.data?.id || result?.id || null;

      // Log the SMS
      await this.prisma.smsLog.create({
        data: {
          companyId,
          to,
          message,
          status,
          senderType,
          externalId: externalId ? String(externalId) : null,
        },
      });

      if (!response.ok) {
        this.logger.error(`SMS Leopard API error: ${JSON.stringify(result)}`);
        throw new InternalServerErrorException(
          `Failed to send SMS (HTTP ${response.status}): ${result?.message || 'Unknown error'}`,
        );
      }

      return { success: true, ...result, senderType };
    } catch (error) {
      this.logger.error(`[SMS] Failed to send message to ${to}: ${error.message}`);
      
      // Log failure even if fetch fails
      await this.prisma.smsLog.create({
        data: {
          companyId,
          to,
          message,
          status: 'FAILED',
          senderType,
        },
      });

      throw error;
    }
  }
}
