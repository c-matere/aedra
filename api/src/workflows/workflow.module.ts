import { Module, Global } from '@nestjs/common';
import { WorkflowEngine } from './workflow.engine';
import { CacheModule } from '@nestjs/cache-manager';

@Global()
@Module({
    imports: [CacheModule.register()],
    providers: [WorkflowEngine],
    exports: [WorkflowEngine],
})
export class WorkflowModule {}
