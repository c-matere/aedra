import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InvoicesService } from '../invoices/invoices.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class FinancialDrumbeatService {
  private readonly logger = new Logger(FinancialDrumbeatService.name);

  constructor(
    @Inject(forwardRef(() => InvoicesService))
    private readonly invoicesService: InvoicesService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * The Financial Drumbeat: Runs on the 1st of every month at 00:01.
   * Generates rent invoices for all active leases across all companies.
   */
  @Cron('1 0 1 * *') // 00:01 on the 1st of the month
  async triggerMonthlyInvoicing() {
    this.logger.log('[Drumbeat] Initializing automated monthly invoicing cycle...');
    
    try {
      // We need a system-level 'actor' context to bypass company-scoping checks if needed,
      // or we iterate through each company.
      const companies = await this.prisma.company.findMany({
        where: { isActive: true },
        select: { id: true, name: true }
      });

      let totalCreated = 0;
      let totalLeases = 0;

      for (const company of companies) {
        this.logger.log(`[Drumbeat] Processing billing for company: ${company.name}`);
        
        // Mock a system actor for each company
        const systemActor: any = {
          userId: 'SYSTEM',
          companyId: company.id,
          role: UserRole.SUPER_ADMIN,
        };

        const result = await this.invoicesService.generateMonthlyInvoices(systemActor);
        totalCreated += result.createdCount;
        totalLeases += result.totalLeases;
      }

      this.logger.log(
        `[Drumbeat] Completed invoicing cycle. Created ${totalCreated} invoices across ${totalLeases} active leases.`,
      );
    } catch (error) {
      this.logger.error(`[Drumbeat] Critical failure in invoicing cycle: ${error.message}`);
    }
  }

  /**
   * Optional: Mid-month follow-up for arrears (e.g. on the 10th)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupDaily() {
    // Placeholder for daily arrears checks or automatic late fee applications
    // This maintains the "Operational Matrix" 6-month reliability goal.
  }
}
