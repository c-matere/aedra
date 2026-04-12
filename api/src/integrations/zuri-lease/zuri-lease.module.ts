import { Module } from '@nestjs/common';
import { ZuriLeaseService } from './zuri-lease.service';
import { ZuriLeaseController } from './zuri-lease.controller';
import { AedraImportService } from './aedra-import.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CompaniesModule } from '../../companies/companies.module';

@Module({
  imports: [PrismaModule, CompaniesModule],
  providers: [ZuriLeaseService, AedraImportService],
  controllers: [ZuriLeaseController],
  exports: [ZuriLeaseService, AedraImportService],
})
export class ZuriLeaseModule {}
