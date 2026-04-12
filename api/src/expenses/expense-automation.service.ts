import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { isLastDayOfMonth, getDate, getMonth, getYear, lastDayOfMonth } from 'date-fns';

@Injectable()
export class ExpenseAutomationService {
  private readonly logger = new Logger(ExpenseAutomationService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleRecurringExpenses() {
    this.logger.log('Running daily recurring expenses check...');
    await this.processExpenses();
  }

  async processExpenses() {
    const today = new Date();
    const day = getDate(today);
    const month = getMonth(today);
    const year = getYear(today);
    const isLastDay = isLastDayOfMonth(today);

    // Criteria: 
    // 1. Matches today's day
    // 2. OR if today is last day of month, trigger anything set for > today
    const where: any = {
      isActive: true,
      OR: [
        { dayOfMonth: day },
        ...(isLastDay ? [{ dayOfMonth: { gt: day } }] : []),
      ],
    };

    const dueExpenses = await this.prisma.recurringExpense.findMany({
      where,
    });

    this.logger.log(`Found ${dueExpenses.length} potential recurring expenses to process.`);

    for (const record of dueExpenses) {
      // Check if already generated for this month
      if (record.lastGeneratedAt) {
        const lastGen = new Date(record.lastGeneratedAt);
        if (getMonth(lastGen) === month && getYear(lastGen) === year) {
          continue; // Already done
        }
      }

      try {
        await this.prisma.$transaction(async (tx) => {
          // 1. Create the regular expense
          await tx.expense.create({
            data: {
              description: record.description,
              amount: record.amount,
              category: record.category,
              companyId: record.companyId,
              propertyId: record.propertyId,
              date: today,
              notes: 'Automatically generated from recurring schedule.',
            },
          });

          // 2. Update lastGeneratedAt
          await tx.recurringExpense.update({
            where: { id: record.id },
            data: { lastGeneratedAt: today },
          });
        });

        this.logger.log(`Generated expense for: ${record.description} (Property: ${record.propertyId})`);
      } catch (err) {
        this.logger.error(`Failed to generate expense for record ${record.id}: ${err.message}`);
      }
    }
  }
}
