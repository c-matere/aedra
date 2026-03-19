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

  async handleC2BWebhook(data: MpesaWebhookDto) {
    const startTime = Date.now();
    this.logger.log(`[M-Pesa] Webhook received: ${data.TransID} | ${data.MSISDN} | KES ${data.TransAmount}`);

    const amount = parseFloat(data.TransAmount);
    const mpesaCode = data.TransID;
    const phone = data.MSISDN.startsWith('254') ? data.MSISDN : `254${data.MSISDN.slice(-9)}`;
    const reference = data.BillRefNumber;

    // STEP 1 — Idempotency guard (exact-match duplicate detection)
    const existingPayment = await this.prisma.payment.findFirst({
      where: { reference: mpesaCode },
    });
    if (existingPayment) {
      this.logger.warn(`[M-Pesa] Duplicate ignored: ${mpesaCode}`);
      return { ResultCode: 0, ResultDesc: 'Duplicate ignored' };
    }

    // STEP 2 — Identity resolution
    const tenant = await this.findTenantByPhone(phone, reference);
    if (!tenant) {
      this.logger.warn(`[M-Pesa] Unmatched payment: ${mpesaCode} from ${phone} KES ${amount}`);
      await this.alertAgentUnmatchedPayment(phone, amount, mpesaCode);
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
        notes: `M-Pesa ${matchStatus}. Phone: ${phone}. Ref: ${reference || 'N/A'}`,
      },
      include: {
        lease: {
          include: {
            tenant: true,
            unit: { include: { property: { include: { company: true } } } }
          }
        }
      }
    });

    // STEP 5 — Commission (fire-and-forget, non-blocking)
    this.financesService.recordCommission(payment.id).catch(err =>
      this.logger.error(`[M-Pesa] Commission record failed for ${payment.id}: ${err.message}`)
    );

    // STEP 6 — Receipt + agent notification (atomic)
    await this.processReceipt(payment, matchStatus);

    const elapsed = Date.now() - startTime;
    if (elapsed > 3000) {
      this.logger.warn(`[M-Pesa] ⚠️  SLA BREACH: ${mpesaCode} took ${elapsed}ms (target < 3000ms)`);
    } else {
      this.logger.log(`[M-Pesa] ✅ Processed ${mpesaCode} in ${elapsed}ms (${matchStatus})`);
    }

    return { ResultCode: 0, ResultDesc: 'Accepted and processed' };
  }

  private async findTenantByPhone(phone: string, reference?: string) {
    const rawDigits = phone.replace(/\D/g, '');
    const last9 = rawDigits.slice(-9);
    
    const possibleFormats = [
      rawDigits,
      `+${rawDigits}`,
      `0${last9}`,
      last9,
    ];

    // Try finding by phone first
    let tenant = await this.prisma.tenant.findFirst({
      where: {
        phone: { in: possibleFormats },
        deletedAt: null,
      },
      include: {
        leases: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    // If reference is provided and looks like a unit number, try matching that too
    if (!tenant && reference) {
      const unit = await this.prisma.unit.findFirst({
        where: {
            unitNumber: { equals: reference, mode: 'insensitive' },
            deletedAt: null
        },
        include: {
            leases: {
                where: { status: 'ACTIVE' },
                include: { tenant: { include: { leases: { where: { status: 'ACTIVE' }, take: 1 } } } },
                orderBy: { createdAt: 'desc' },
                take: 1
            }
        }
      });
      if (unit?.leases?.[0]?.tenant) {
          tenant = unit.leases[0].tenant as any;
      }
    }

    return tenant;
  }

  private async alertAgentUnmatchedPayment(phone: string, amount: number, mpesaCode: string) {
    this.logger.warn(`COULD NOT MATCH PAYMENT: KES ${amount} from ${phone} (${mpesaCode})`);
    
    // Find all global SUPER_ADMINs to notify (since we don't know the company for an unmatched payment)
    const admins = await this.prisma.user.findMany({
      where: { role: 'SUPER_ADMIN' },
      select: { phone: true }
    });

    const message = `⚠️ *UNMATCHED PAYMENT* ⚠️\nAmount: KES ${amount.toLocaleString()}\nFrom: ${phone}\nM-Pesa Ref: ${mpesaCode}\n\nPlease check the dashboard or ask the tenant to confirm their details.`;

    for (const admin of admins) {
      if (admin.phone) {
        await this.whatsappService.sendTextMessage({
          to: admin.phone, // Sent via SYSTEM sender type
          text: message
        }).catch(err => this.logger.error(`Failed to alert admin ${admin.phone}: ${err.message}`));
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

    // STEP 8 — Deliver to tenant
    await this.whatsappService.sendTextMessage({
        companyId: company.id,
        to: tenant.phone,
        text: receiptContent
    }).catch(err => this.logger.error(`Receipt delivery failed to tenant ${tenant.phone}: ${err.message}`));

    // STEP 9 — Notify agent
    const agentMessage = isSwahili
        ? `✓ ${tenant.firstName} Kitengo ${unit.unitNumber} — KES ${amount.toLocaleString()} imepokelewa. Risiti imetumwa.`
        : `✓ ${tenant.firstName} Unit ${unit.unitNumber} — KES ${amount.toLocaleString()} received. Receipt sent. ${matchStatus !== 'EXACT' ? `[${matchStatus}]` : ''}`;

    // Find company owner/admin for notification
    const admin = await this.prisma.user.findFirst({
        where: { companyId: company.id, role: 'COMPANY_ADMIN' },
        select: { phone: true }
    });

    if (admin?.phone) {
        await this.whatsappService.sendTextMessage({
            companyId: company.id,
            to: admin.phone,
            text: agentMessage
        }).catch(err => this.logger.error(`Agent notification failed to ${admin.phone}: ${err.message}`));
    }
  }
}
