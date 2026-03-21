import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from './whatsapp.service';
import { UnitsService } from '../units/units.service';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
    private readonly unitsService: UnitsService,
  ) {}

  async sendBulkReminders(actor: AuthenticatedUser, propertyId?: string) {
    this.logger.log(
      `Starting bulk reminder process for company ${actor.companyId}`,
    );

    // STEP 2 & 3 — Build recipient list using portfolio snapshot
    const snapshot = await this.unitsService.getPortfolioSnapshot(
      actor,
      propertyId,
    );

    let totalSent = 0;
    const results: any[] = [];

    for (const [propId, data] of Object.entries(snapshot)) {
      const d = data;
      for (const unit of d.unpaid_this_month) {
        const balance = unit.expected - unit.collected;
        if (balance <= 0) continue;

        // STEP 4 — Tone logic
        const daysOverdue = this.calculateDaysOverdue();
        const tone = this.determineTone(daysOverdue);

        const tenant = await this.prisma.tenant.findUnique({
          where: {
            id: unit.tenantId || (await this.findTenantId(unit.number, propId)),
          },
          select: { phone: true, firstName: true, language: true },
        });

        if (!tenant || !tenant.phone) continue;

        const message = this.generateReminderMessage(
          tenant,
          unit.number,
          balance,
          tone,
        );

        // STEP 5 — Async send (simulated async within loop for now,
        // in production this would be a queue)
        try {
          await this.whatsappService.sendTextMessage({
            companyId: actor.companyId,
            to: tenant.phone,
            text: message,
          });
          totalSent++;
          results.push({
            tenant: tenant.firstName,
            unit: unit.number,
            status: 'SENT',
          });
        } catch (err) {
          this.logger.error(
            `Failed to send reminder to ${tenant.phone}: ${err.message}`,
          );
          results.push({
            tenant: tenant.firstName,
            unit: unit.number,
            status: 'FAILED',
            error: err.message,
          });
        }
      }
    }

    return {
      success: true,
      totalSent,
      details: results,
    };
  }

  private calculateDaysOverdue(): number {
    const now = new Date();
    const day = now.getDate();
    // Assuming rent is due on the 1st
    return day;
  }

  private determineTone(days: number): 'GENTLE' | 'FIRM' | 'URGENT' {
    if (days <= 5) return 'GENTLE';
    if (days <= 10) return 'FIRM';
    return 'URGENT';
  }

  private generateReminderMessage(
    tenant: any,
    unitNumber: string,
    balance: number,
    tone: 'GENTLE' | 'FIRM' | 'URGENT',
  ) {
    const isSwahili = (tenant.language || 'en').toLowerCase() === 'sw';
    const amountStr = `KES ${balance.toLocaleString()}`;

    if (isSwahili) {
      if (tone === 'GENTLE') {
        return `Habari ${tenant.firstName}, huu ni ukumbusho wa kirafiki kuhusu kodi ya mwezi huu wa Kitengo ${unitNumber}. Salio ni ${amountStr}. Tafadhali lipa ukiweza. Asante!`;
      } else if (tone === 'FIRM') {
        return `Habari ${tenant.firstName}, tunakukumbusha kuwa kodi ya Kitengo ${unitNumber} (${amountStr}) bado haijalipwa. Tafadhali fanya malipo haraka iwezekanavyo.`;
      } else {
        return `ILANI: Kodi ya Kitengo ${unitNumber} imepitiliza muda sana. Salio ni ${amountStr}. Tafadhali lipa mara moja ili kuepuka hatua zaidi.`;
      }
    } else {
      if (tone === 'GENTLE') {
        return `Hi ${tenant.firstName}, just a friendly reminder regarding this month's rent for Unit ${unitNumber}. The balance is ${amountStr}. Please settle at your earliest convenience. Thank you!`;
      } else if (tone === 'FIRM') {
        return `Hi ${tenant.firstName}, following up on the outstanding rent for Unit ${unitNumber}. The balance is ${amountStr}. Please ensure payment is made promptly.`;
      } else {
        return `URGENT NOTICE: Your rent for Unit ${unitNumber} is significantly overdue. The balance is ${amountStr}. Please settle immediately to avoid further action.`;
      }
    }
  }

  private async findTenantId(unitNumber: string, propertyId: string) {
    const unit = await this.prisma.unit.findFirst({
      where: { unitNumber, propertyId },
      include: { leases: { where: { status: 'ACTIVE' }, take: 1 } },
    });
    return unit?.leases?.[0]?.tenantId;
  }
}
