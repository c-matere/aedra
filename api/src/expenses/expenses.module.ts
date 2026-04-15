import { Module } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RecurringExpensesService } from './recurring-expenses.service';
import { RecurringExpensesController } from './recurring-expenses.controller';
import { ExpenseAutomationService } from './expense-automation.service';

@Module({
  imports: [PrismaModule],
  controllers: [ExpensesController, RecurringExpensesController],
  providers: [
    ExpensesService,
    RecurringExpensesService,
    ExpenseAutomationService,
  ],
  exports: [ExpensesService, RecurringExpensesService],
})
export class ExpensesModule {}
