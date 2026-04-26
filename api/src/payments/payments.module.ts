import { Module, Global, forwardRef } from '@nestjs/common';
import { MpesaService } from './mpesa.service';
import { PaymentsService } from './payments.service';
import { MpesaController } from './mpesa.controller';
import { PaymentsController } from './payments.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MessagingModule } from '../messaging/messaging.module';
import { FinancesModule } from '../finances/finances.module';
import { ReportsModule } from '../reports/reports.module';
import { AiModule } from '../ai/ai.module';

@Global()
@Module({
  imports: [
    PrismaModule,
    forwardRef(() => MessagingModule),
    FinancesModule,
    ReportsModule,
    forwardRef(() => AiModule),
  ],
  controllers: [MpesaController, PaymentsController],
  providers: [MpesaService, PaymentsService],
  exports: [MpesaService, PaymentsService],
})
export class PaymentsModule {}
