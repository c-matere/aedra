import { Module, forwardRef } from '@nestjs/common';
import { TodoService } from './todo.service';
import { TodoController } from './todo.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MessagingModule } from '../messaging/messaging.module';
import { DailyTodoJob } from './daily-todo.job';
import { TodoSchedulerService } from './todo-scheduler.service';
import { BullModule } from '@nestjs/bullmq';
import { AI_BACKGROUND_QUEUE } from '../ai/ai.constants';

@Module({
  imports: [
    PrismaModule,
    MessagingModule,
    BullModule.registerQueue({
      name: AI_BACKGROUND_QUEUE,
    }),
  ],
  controllers: [TodoController],
  providers: [TodoService, DailyTodoJob, TodoSchedulerService],
  exports: [TodoService, DailyTodoJob, TodoSchedulerService],
})
export class TodoModule {}
