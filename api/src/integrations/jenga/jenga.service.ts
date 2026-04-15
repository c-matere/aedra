import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JengaConnector } from './jenga.connector';
import { JengaAuthConfig, JengaStkPushRequest } from './types';
import { VaultService } from '../../common/vault.service';

@Injectable()
export class JengaService {
  private readonly logger = new Logger(JengaService.name);
  private connectors: Map<string, JengaConnector> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly vaultService: VaultService,
  ) {}

  /**
   * Gets a configured JengaConnector for a specific company.
   * Caches the connector instance to preserve OAuth token lifecycle.
   */
  private async getConnector(companyId: string): Promise<JengaConnector> {
    if (this.connectors.has(companyId)) {
      return this.connectors.get(companyId)!;
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        jengaMerchantCode: true,
        jengaConsumerSecret: true,
        jengaApiKey: true,
        jengaPrivateKey: true,
        jengaEnabled: true,
      },
    });

    if (!company || !company.jengaEnabled) {
      throw new NotFoundException(
        `Jenga is not enabled or configured for company ${companyId}`,
      );
    }

    // Decrypt sensitive fields
    const sensitiveFields = [
      'jengaMerchantCode',
      'jengaConsumerSecret',
      'jengaApiKey',
      'jengaPrivateKey',
    ];
    const decrypted = this.vaultService.decryptObject(company, sensitiveFields);

    if (
      !decrypted.jengaMerchantCode ||
      !decrypted.jengaApiKey ||
      !decrypted.jengaPrivateKey
    ) {
      throw new Error(
        `Incomplete Jenga configuration for company ${companyId}`,
      );
    }

    const config: JengaAuthConfig = {
      merchantCode: decrypted.jengaMerchantCode,
      consumerSecret: decrypted.jengaConsumerSecret || '',
      apiKey: decrypted.jengaApiKey,
      privateKey: decrypted.jengaPrivateKey.replace(/\\n/g, '\n'),
    };

    const connector = new JengaConnector(config);
    this.connectors.set(companyId, connector);
    return connector;
  }

  /**
   * Send an STK Push to a tenant for a specific invoice.
   */
  async initiatePayment(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        lease: {
          include: {
            tenant: {
              include: {
                company: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');
    const companyId = invoice.lease.tenant.companyId;
    if (!companyId) throw new Error('Invoice has no associated company');

    if (!invoice.lease.tenant.phone)
      throw new Error('Tenant has no phone number');

    const connector = await this.getConnector(companyId);

    const amount = invoice.amount.toString();
    const phone = invoice.lease.tenant.phone.replace('+', '');
    // Recommendation: Use invoice ID as reference for easy reconciliation
    const reference = invoice.id;

    const request: JengaStkPushRequest = {
      customer: {
        mobileNumber: phone,
        countryCode: 'KE',
      },
      transaction: {
        amount,
        description: `Rent payment for ${invoice.lease.propertyId}`,
        type: 'PAYMENT',
        reference,
      },
    };

    try {
      this.logger.log(
        `Initiating Jenga STK Push for company ${companyId}, invoice ${invoiceId} to ${phone}`,
      );
      const result = await connector.initiateStkPush(request);

      if (result.status) {
        await this.prisma.auditLog.create({
          data: {
            action: 'JENGA_STK_PUSH_INITIATED',
            outcome: 'SUCCESS',
            method: 'POST',
            path: '/integrations/jenga/stkpush',
            entity: 'Invoice',
            targetId: invoiceId,
            actorCompanyId: companyId,
            metadata: result as any,
          },
        });
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Error in Jenga STK Push (Company: ${companyId}): ${error.message}`,
      );
      throw new InternalServerErrorException(
        `Failed to initiate Jenga payment: ${error.message}`,
      );
    }
  }

  /**
   * Verify an incoming payment and reconcile it.
   * This is called by the controller when a webhook is received.
   */
  async reconcilePayment(companyId: string, payload: any) {
    this.logger.log(
      `Attempting reconciliation for company ${companyId}: ${payload.transaction?.reference}`,
    );

    const reference = payload.transaction?.reference;
    const amount = parseFloat(payload.transaction?.amount || '0');
    const payerPhone = payload.customer?.mobileNumber;

    // 1. Try to find by Invoice ID (Direct reference)
    let invoice = await this.prisma.invoice.findFirst({
      where: {
        id: reference,
        lease: { tenant: { companyId } },
      },
      include: { lease: true },
    });

    // 2. Fallback: Search for the tenant by phone number
    if (!invoice && payerPhone) {
      this.logger.log(
        `Reference match failed for ${reference}. Falling back to phone lookup: ${payerPhone}`,
      );
      const tenant = await this.prisma.tenant.findFirst({
        where: {
          phone: { contains: payerPhone.slice(-9) }, // Match last 9 digits
          companyId,
        },
        include: {
          leases: {
            where: { status: 'ACTIVE' },
            include: {
              invoices: {
                where: { status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
                orderBy: { dueDate: 'asc' },
              },
            },
          },
        },
      });

      if (
        tenant &&
        tenant.leases.length > 0 &&
        tenant.leases[0].invoices.length > 0
      ) {
        invoice = tenant.leases[0].invoices[0] as any;
        this.logger.log(
          `Found pending invoice ${invoice?.id} for tenant ${tenant.id} via phone match.`,
        );
      }
    }

    if (!invoice) {
      this.logger.warn(
        `Could not reconcile payment ${payload.transactionId} for company ${companyId}. No matching invoice/tenant found.`,
      );
      return {
        reconciled: false,
        reason: 'No matching invoice or tenant found',
      };
    }

    // 3. Update Invoice and Create Payment
    await (this.prisma as any).$transaction(async (tx: any) => {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: amount >= invoice.amount ? 'PAID' : 'PARTIALLY_PAID' },
      });

      await tx.payment.create({
        data: {
          amount: amount,
          method: 'BANK_TRANSFER',
          type: 'RENT',
          reference: payload.transactionId || reference,
          leaseId: invoice.leaseId,
          notes: `Auto-reconciled via Jenga. Payer: ${payerPhone || 'Unknown'}`,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'JENGA_PAYMENT_RECONCILED',
          outcome: 'SUCCESS',
          entity: 'Invoice',
          targetId: invoice.id,
          actorCompanyId: companyId,
          metadata: payload,
        },
      });
    });

    return { reconciled: true, invoiceId: invoice.id };
  }
}
