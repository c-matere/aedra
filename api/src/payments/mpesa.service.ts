import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../messaging/whatsapp.service';
import { FinancesService } from '../finances/finances.service';
import { PaymentMethod, PaymentType, UnitStatus } from '@prisma/client';

export class MpesaWebhookDto {
  TransactionType?: string;
  TransID: string;
  TransTime: string;
  TransAmount: string;
  BusinessShortCode?: string;
  BillRefNumber?: string;
  InvoiceNumber?: string;
  OrgAccountBalance?: string;
  ThirdPartyTransID?: string;
  MSISDN: string;
  FirstName?: string;
  MiddleName?: string;
  LastName?: string;
}

@Injectable()
export class MpesaService {
  private readonly logger = new Logger(MpesaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
    private readonly financesService: FinancesService,
  ) {}

  async handleC2BWebhook(data: MpesaWebhookDto, manualCompanyId?: string) {
    const startTime = Date.now();
    this.logger.log(
      `[M-Pesa] Webhook received: ${data.TransID} | ${data.MSISDN} | KES ${data.TransAmount} | ShortCode: ${data.BusinessShortCode}`,
    );

    const amount = parseFloat(data.TransAmount);
    const mpesaCode = data.TransID;
    const phone = data.MSISDN.startsWith('254')
      ? data.MSISDN
      : `254${data.MSISDN.slice(-9)}`;
    const reference = data.BillRefNumber;
    const shortCode = data.BusinessShortCode;

    // STEP 0 — Multi-tenant Company resolution
    let company;
    if (manualCompanyId) {
      company = await this.prisma.company.findUnique({
        where: { id: manualCompanyId },
      });
    } else if (shortCode) {
      company = await this.prisma.company.findUnique({
        where: { mpesaShortcode: shortCode },
      });
    }

    if (!company) {
      this.logger.error(
        `[M-Pesa] FATAL: Received payment for unregistered or missing company. ShortCode: ${shortCode}, ManualId: ${manualCompanyId}`,
      );
      // We still accept it to stop Safaricom retries, but we can't process it automatically
      return { ResultCode: 0, ResultDesc: 'Accepted but company not found' };
    }

    // STEP 1 — Idempotency guard (exact-match duplicate detection)
    const existingPayment = await this.prisma.payment.findFirst({
      where: { reference: mpesaCode },
    });
    if (existingPayment) {
      this.logger.warn(`[M-Pesa] Duplicate ignored: ${mpesaCode}`);
      return { ResultCode: 0, ResultDesc: 'Duplicate ignored' };
    }

    // STEP 2 — Identity resolution (scoped to company)
    const tenant = await this.findTenantByPhone(phone, company.id, reference);
    if (!tenant) {
      this.logger.warn(
        `[M-Pesa] Unmatched payment: ${mpesaCode} from ${phone} KES ${amount} [Company: ${company.name}]`,
      );
      await this.alertAgentUnmatchedPayment(
        phone,
        amount,
        mpesaCode,
        company.id,
      );
      return { ResultCode: 0, ResultDesc: 'Accepted but unmatched' };
    }

    // STEP 3 — Active lease resolution
    const lease = tenant.leases[0];
    if (!lease) {
      this.logger.error(`[M-Pesa] Tenant ${tenant.id} has no active lease`);
      return { ResultCode: 1, ResultDesc: 'Internal Error - No Active Lease' };
    }

    const expectedRent = lease.rentAmount;
    let matchStatus = 'EXACT';
    if (amount > expectedRent) matchStatus = 'OVERPAYMENT';
    else if (amount < expectedRent) matchStatus = 'PARTIAL';

    // STEP 4 — Record payment
    const payment = await this.prisma.payment.create({
      data: {
        amount,
        paidAt: new Date(),
        method: PaymentMethod.MPESA,
        type: PaymentType.RENT,
        reference: mpesaCode,
        leaseId: lease.id,
        notes: `M-Pesa ${matchStatus}. Phone: ${phone}. Ref: ${reference || 'N/A'}. Company: ${company.name}`,
      },
      include: {
        lease: {
          include: {
            tenant: true,
            unit: { include: { property: { include: { company: true } } } },
          },
        },
      },
    });

    // STEP 5 — Commission (fire-and-forget, non-blocking)
    this.financesService
      .recordCommission(payment.id)
      .catch((err) =>
        this.logger.error(
          `[M-Pesa] Commission record failed for ${payment.id}: ${err.message}`,
        ),
      );

    // STEP 6 — Receipt + agent notification (atomic)
    await this.processReceipt(payment, matchStatus);

    const elapsed = Date.now() - startTime;
    if (elapsed > 3000) {
      this.logger.warn(
        `[M-Pesa] ⚠️  SLA BREACH: ${mpesaCode} took ${elapsed}ms (target < 3000ms)`,
      );
    } else {
      this.logger.log(
        `[M-Pesa] ✅ Processed ${mpesaCode} in ${elapsed}ms (${matchStatus})`,
      );
    }

    return { ResultCode: 0, ResultDesc: 'Accepted and processed' };
  }

  private async findTenantByPhone(
    phone: string,
    companyId: string,
    reference?: string,
  ) {
    const rawDigits = phone.replace(/\D/g, '');
    const last9 = rawDigits.slice(-9);

    const possibleFormats = [rawDigits, `+${rawDigits}`, `0${last9}`, last9];

    // Try finding by phone first, scoped to company
    let tenant = await this.prisma.tenant.findFirst({
      where: {
        phone: { in: possibleFormats },
        companyId,
        deletedAt: null,
      },
      include: {
        leases: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    // If reference is provided and looks like a unit number, try matching that too
    if (!tenant && reference) {
      const unit = await this.prisma.unit.findFirst({
        where: {
          unitNumber: { equals: reference, mode: 'insensitive' },
          property: { companyId },
          deletedAt: null,
        },
        include: {
          leases: {
            where: { status: 'ACTIVE' },
            include: {
              tenant: {
                include: { leases: { where: { status: 'ACTIVE' }, take: 1 } },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
      if (unit?.leases?.[0]?.tenant) {
        tenant = unit.leases[0].tenant as any;
      }
    }

    return tenant;
  }

  private async alertAgentUnmatchedPayment(
    phone: string,
    amount: number,
    mpesaCode: string,
    companyId?: string,
  ) {
    this.logger.warn(
      `COULD NOT MATCH PAYMENT: KES ${amount} from ${phone} (${mpesaCode}) for Company ${companyId}`,
    );

    // Find company owners/admins for notification
    const admins = await this.prisma.user.findMany({
      where: {
        companyId,
        role: { in: ['COMPANY_ADMIN', 'SUPER_ADMIN'] },
        isActive: true,
      },
      select: { phone: true },
    });

    const message = `⚠️ *UNMATCHED PAYMENT* ⚠️\nAmount: KES ${amount.toLocaleString()}\nFrom: ${phone}\nM-Pesa Ref: ${mpesaCode}\n\nPlease check the dashboard or ask the tenant to confirm their details.`;

    for (const admin of admins) {
      if (admin.phone) {
        await this.whatsappService
          .sendTextMessage({
            companyId,
            to: admin.phone,
            text: message,
          })
          .catch((err) =>
            this.logger.error(
              `Failed to alert admin ${admin.phone}: ${err.message}`,
            ),
          );
      }
    }
  }

  private async processReceipt(payment: any, matchStatus: string) {
    const { lease } = payment;
    const { tenant, unit } = lease;
    const property = unit.property;
    const company = property.company;

    const amount = payment.amount;
    const expected = lease.rentAmount;
    const overage = Math.max(0, amount - expected);
    const shortfall = Math.max(0, expected - amount);

    let receiptNote = '';
    const isSwahili = (tenant.language || 'en').toLowerCase() === 'sw';

    if (matchStatus === 'OVERPAYMENT') {
      receiptNote = isSwahili
        ? `\nKumbuka: KES ${overage.toLocaleString()} imeingizwa mwezi ujao`
        : `\nNote: KES ${overage.toLocaleString()} credit applied to next month`;
    } else if (matchStatus === 'PARTIAL') {
      receiptNote = isSwahili
        ? `\nMalipo ya sehemu. Bado KES ${shortfall.toLocaleString()} inadaiwa kwa mwezi huu`
        : `\nPartial payment. Balance of KES ${shortfall.toLocaleString()} remains due for this month`;
    }

    const receiptContent = `
AEDRA RECEIPT: ${payment.reference}
----------------------------
Tenant: ${tenant.firstName} ${tenant.lastName}
Unit: ${unit.unitNumber}
Property: ${property.name}
Amount: KES ${amount.toLocaleString()}
Date: ${new Date().toLocaleDateString()}
Status: ${matchStatus}
${receiptNote}

Managed by: ${company.name}
Thank you!
    `.trim();

    // STEP 8 — Deliver to tenant (using template for better deliverability)
    const shortfall = Math.max(0, expected - amount);
    const balance = shortfall; // Simplified balance calculation

    await this.whatsappService
      .sendPaymentConfirmation({
        companyId: company.id,
        to: tenant.phone,
        tenantName: tenant.firstName,
        amount: amount,
        unitNumber: unit.unitNumber,
        newBalance: balance,
      })
      .catch((err) =>
        this.logger.error(
          `Receipt delivery failed (Template) to tenant ${tenant.phone}: ${err.message}`,
        ),
      );

    // STEP 9 — Notify agent
    const agentMessage = isSwahili
      ? `✓ ${tenant.firstName} Kitengo ${unit.unitNumber} — KES ${amount.toLocaleString()} imepokelewa. Risiti imetumwa.`
      : `✓ ${tenant.firstName} Unit ${unit.unitNumber} — KES ${amount.toLocaleString()} received. Receipt sent. ${matchStatus !== 'EXACT' ? `[${matchStatus}]` : ''}`;

    // Find company owner/admin for notification
    const admin = await this.prisma.user.findFirst({
      where: { companyId: company.id, role: 'COMPANY_ADMIN' },
      select: { phone: true },
    });

    if (admin?.phone) {
      await this.whatsappService
        .sendTextMessage({
          companyId: company.id,
          to: admin.phone,
          text: agentMessage,
        })
        .catch((err) =>
          this.logger.error(
            `Agent notification failed to ${admin.phone}: ${err.message}`,
          ),
        );
    }
  }

  // --- NEW: OUTGOING API METHODS ---

  private async getCredentials(companyId?: string) {
    if (companyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: {
          mpesaConsumerKey: true,
          mpesaConsumerSecret: true,
          mpesaPasskey: true,
          mpesaShortcode: true,
          mpesaEnvironment: true,
        },
      });

      if (company?.mpesaConsumerKey && company?.mpesaConsumerSecret) {
        return {
          consumerKey: company.mpesaConsumerKey,
          consumerSecret: company.mpesaConsumerSecret,
          passkey: company.mpesaPasskey || process.env.MPESA_PASSKEY,
          shortCode:
            company.mpesaShortcode || process.env.MPESA_SHORTCODE || '174379',
          environment:
            company.mpesaEnvironment ||
            process.env.MPESA_ENVIRONMENT ||
            'sandbox',
        };
      }

      throw new ConflictException(
        `M-Pesa is not configured for company ${companyId}. Please set up Consumer Key and Secret.`,
      );
    }

    return {
      consumerKey: process.env.MPESA_CONSUMER_KEY,
      consumerSecret: process.env.MPESA_CONSUMER_SECRET,
      passkey: process.env.MPESA_PASSKEY,
      shortCode: process.env.MPESA_SHORTCODE || '174379',
      environment: process.env.MPESA_ENVIRONMENT || 'sandbox',
    };
  }

  async getAccessToken(companyId?: string) {
    const creds = await this.getCredentials(companyId);
    const auth = Buffer.from(
      `${creds.consumerKey}:${creds.consumerSecret}`,
    ).toString('base64');

    const url =
      creds.environment === 'sandbox'
        ? 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
        : 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Basic ${auth}` },
      });
      const data = await response.json();
      if (!data.access_token) {
        throw new Error(data.errorMessage || 'Failed to get access token');
      }
      return data.access_token;
    } catch (err) {
      this.logger.error(`[M-Pesa] Token generation failed: ${err.message}`);
      throw err;
    }
  }

  async stkPush(
    phone: string,
    amount: number,
    reference: string,
    companyId?: string,
  ) {
    if (!phone || phone.length < 9) {
      throw new Error(`Invalid phone number for STK Push: ${phone}`);
    }
    const creds = await this.getCredentials(companyId);
    const token = await this.getAccessToken(companyId);
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 14);
    const password = Buffer.from(
      `${creds.shortCode}${creds.passkey}${timestamp}`,
    ).toString('base64');

    const callbackUrl = companyId
      ? `${process.env.API_URL}/payments/c-p/callback/${companyId}`
      : `${process.env.API_URL}/payments/c-p/callback`;
    const formattedPhone = phone.startsWith('254')
      ? phone
      : `254${phone.slice(-9)}`;

    const body = {
      BusinessShortCode: creds.shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: formattedPhone,
      PartyB: creds.shortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: reference,
      TransactionDesc: `Payment for ${reference}`,
    };

    const stkUrl =
      creds.environment === 'sandbox'
        ? 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
        : 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

    try {
      this.logger.log(
        `[M-Pesa] Triggering STK Push for ${formattedPhone} | KES ${amount} | Company: ${companyId || 'Global'}`,
      );
      const response = await fetch(stkUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      return data;
    } catch (err) {
      this.logger.error(`[M-Pesa] STK Push failed: ${err.message}`);
      throw err;
    }
  }

  async registerUrls(companyId?: string) {
    const creds = await this.getCredentials(companyId);
    const token = await this.getAccessToken(companyId);
    const validationUrl = `${process.env.API_URL}/payments/c-p/validate`;
    const confirmationUrl = `${process.env.API_URL}/payments/c-p/confirm`;

    const body = {
      ShortCode: creds.shortCode,
      ResponseType: 'Completed',
      ConfirmationURL: confirmationUrl,
      ValidationURL: validationUrl,
    };

    const url =
      creds.environment === 'sandbox'
        ? 'https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl'
        : 'https://api.safaricom.co.ke/mpesa/c2b/v1/registerurl';

    try {
      this.logger.log(
        `[M-Pesa] Registering C2B URLs for shortcode ${creds.shortCode}`,
      );
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      return data;
    } catch (err) {
      this.logger.error(`[M-Pesa] URL Registration failed: ${err.message}`);
      throw err;
    }
  }
}
