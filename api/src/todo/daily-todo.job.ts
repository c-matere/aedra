import { Injectable, Logger } from '@nestjs/common';
import { TodoService } from './todo.service';
import { EmailService } from '../messaging/email.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DailyTodoJob {
  private readonly logger = new Logger(DailyTodoJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly todoService: TodoService,
    private readonly emailService: EmailService,
  ) {}

  async run() {
    this.logger.log('Starting daily to-do generation batch job...');

    // Find all active staff and admins who have an email
    const staff = await this.prisma.user.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        role: { in: ['COMPANY_STAFF', 'COMPANY_ADMIN'] },
        email: { not: '' },
      },
    });

    for (const member of staff) {
      try {
        this.logger.log(`Processing daily tasks for ${member.email}...`);
        const tasks = await this.todoService.generateDailyCriticalTasks(
          member.id,
        );

        if (tasks.length > 0) {
          const html = this.emailService.generateTodoEmailHtml(
            member.firstName,
            tasks,
          );
          await this.emailService.sendMail(
            member.email,
            'Your Daily To-Do List - Aedra',
            html,
          );
          this.logger.log(`Daily to-do email sent to ${member.email}`);
        } else {
          this.logger.log(`No critical tasks today for ${member.email}`);
        }
      } catch (err) {
        this.logger.error(`Job failed for user ${member.id}: ${err.message}`);
      }
    }

    this.logger.log('Daily to-do batch job completed.');
  }
}
