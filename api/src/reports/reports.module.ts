import { Module, forwardRef } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportsGeneratorService } from './reports-generator.service';
import { ReportIntelligenceService } from './report-intelligence.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, forwardRef(() => AiModule)],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsGeneratorService, ReportIntelligenceService],
  exports: [ReportsService, ReportsGeneratorService, ReportIntelligenceService],
})
export class ReportsModule { }
