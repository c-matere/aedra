import { Module } from '@nestjs/common';
import { FinancesService } from './finances.service';
import { FinancesController, OfficeFinancesController } from './finances.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [FinancesController, OfficeFinancesController],
    providers: [FinancesService],
    exports: [FinancesService],
})
export class FinancesModule { }
