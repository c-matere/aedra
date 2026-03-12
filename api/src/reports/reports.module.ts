import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportsGeneratorService } from './reports-generator.service';

@Module({
  imports: [PrismaModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsGeneratorService],
  exports: [ReportsService, ReportsGeneratorService],
})
export class ReportsModule {}
