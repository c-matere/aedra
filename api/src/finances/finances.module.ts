import { Module } from '@nestjs/common';
import { FinancesService } from './finances.service';
import { FinancesController } from './finances.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [FinancesController],
    providers: [FinancesService],
    exports: [FinancesService],
})
export class FinancesModule { }
