import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AI_BACKGROUND_QUEUE } from '../ai/ai.constants';

@Injectable()
export class TodoSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(TodoSchedulerService.name);

  constructor(
    @InjectQueue(AI_BACKGROUND_QUEUE) private readonly todoQueue: Queue,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing Todo Scheduler...');

    // Schedule the daily to-do job for 8:00 AM EAT (UTC+3) -> 5:00 AM UTC
    // Cron: 0 5 * * *
    await this.todoQueue.add(
      'generate_daily_todos',
      {},
      {
        repeat: {
          pattern: '0 5 * * *',
        },
        jobId: 'daily_todo_generation', // Ensure unique job
        removeOnComplete: true,
      },
    );

    this.logger.log('Daily to-do job scheduled for 8:00 AM (05:00 UTC)');
  }

  // Helper to trigger it manually for testing
  async triggerNow() {
    await this.todoQueue.add('generate_daily_todos', {});
  }
}
