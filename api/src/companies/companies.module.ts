import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EncryptionService } from '../common/encryption.service';

@Module({
  imports: [PrismaModule],
  controllers: [CompaniesController],
  providers: [CompaniesService, EncryptionService],
  exports: [CompaniesService, EncryptionService],
})
export class CompaniesModule {}
