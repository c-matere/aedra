import { Module, forwardRef } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { CacheModule } from '@nestjs/cache-manager';
import { ReportsGeneratorService } from './reports-generator.service';
import { ReportIntelligenceService } from './report-intelligence.service';
import { HistoryReportService } from './history-report.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    CacheModule.register(),
    forwardRef(() => AiModule),
  ],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    ReportsGeneratorService,
    ReportIntelligenceService,
    HistoryReportService,
  ],
  exports: [
    ReportsService,
    ReportsGeneratorService,
    ReportIntelligenceService,
    HistoryReportService,
  ],
})
export class ReportsModule {}
