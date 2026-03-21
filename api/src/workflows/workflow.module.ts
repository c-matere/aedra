import { Module, Global } from '@nestjs/common';
import { WorkflowEngine } from './workflow.engine';
import { CacheModule } from '@nestjs/cache-manager';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [CacheModule.register(), PrismaModule],
  providers: [WorkflowEngine],
  exports: [WorkflowEngine],
})
export class WorkflowModule {}
