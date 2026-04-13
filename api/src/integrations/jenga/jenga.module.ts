import { Module } from '@nestjs/common';
import { JengaService } from './jenga.service';
import { JengaController } from './jenga.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { CompaniesModule } from '../../companies/companies.module';

@Module({
  imports: [PrismaModule, CompaniesModule],
  providers: [JengaService],
  controllers: [JengaController],
  exports: [JengaService],
})
export class JengaModule {}
