import { Module, forwardRef } from '@nestjs/common';
import { FinancesService } from './finances.service';
import { FinancialDrumbeatService } from './financial-drumbeat.service';
import {
  FinancesController,
  OfficeFinancesController,
} from './finances.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [PrismaModule, forwardRef(() => InvoicesModule)],
  controllers: [FinancesController, OfficeFinancesController],
  providers: [FinancesService, FinancialDrumbeatService],
  exports: [FinancesService, FinancialDrumbeatService],
})
export class FinancesModule {}
