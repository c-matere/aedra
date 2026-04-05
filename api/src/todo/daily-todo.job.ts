import { Injectable, Logger } from '@nestjs/common';
import { TodoService } from './todo.service';
import { EmailService } from '../messaging/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../messaging/whatsapp.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class DailyTodoJob {
  private readonly logger = new Logger(DailyTodoJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly todoService: TodoService,
    private readonly emailService: EmailService,
    private readonly whatsappService: WhatsappService,
  ) {}

  async run() {
    this.logger.log('Starting daily to-do generation batch job...');

    // Find all active staff and admins
    const members = await this.prisma.user.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        role: { in: [UserRole.COMPANY_STAFF, UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN] },
      },
    });

    await Promise.all(
      members.map(async (member) => {
        try {
          const tasks = await this.todoService.generateDailyCriticalTasks(
            member.id,
          );

          if (tasks.length > 0) {
            const notifications: Promise<any>[] = [];

            // 1. Queue Email if address exists
            if (member.email) {
              this.logger.log(`Sending daily tasks email to ${member.email}...`);
              const html = this.emailService.generateTodoEmailHtml(
                member.firstName,
                tasks,
              );
              notifications.push(
                this.emailService
                  .sendMail(member.email, 'Your Daily To-Do List - Aedra', html)
                  .then(() =>
                    this.logger.log(`Daily to-do email sent to ${member.email}`),
                  ),
              );
            }

            // 2. Queue WhatsApp if phone exists and user is an Admin
            if (
              member.phone &&
              (member.role === UserRole.COMPANY_ADMIN ||
                member.role === UserRole.SUPER_ADMIN)
            ) {
              this.logger.log(
                `Sending daily tasks WhatsApp to ${member.phone}...`,
              );
              const taskList = tasks
                .map(
                  (t, i) => `${i + 1}. *${t.title}*\n   ${t.description || ''}`,
                )
                .join('\n\n');

              notifications.push(
                this.whatsappService
                  .sendMessage({
                    companyId: member.companyId ?? undefined,
                    to: member.phone,
                    templateName: 'daily_todo_summary',
                    languageCode: member.language || 'en',
                    components: [
                      {
                        type: 'body',
                        parameters: [
                          { type: 'text', text: member.firstName },
                          { type: 'text', text: taskList },
                        ],
                      },
                    ],
                  })
                  .then(() =>
                    this.logger.log(
                      `Daily to-do WhatsApp sent to ${member.phone}`,
                    ),
                  ),
              );
            }

            await Promise.all(notifications);
          } else {
            this.logger.log(`No critical tasks today for user ${member.id}`);
          }
        } catch (err) {
          this.logger.error(`Job failed for user ${member.id}: ${err.message}`);
        }
      }),
    );

    this.logger.log('Daily to-do batch job completed.');
  }
}
