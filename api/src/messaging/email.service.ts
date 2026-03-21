import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '1025'),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendMail(to: string, subject: string, html: string) {
    try {
      const info = await this.transporter.sendMail({
        from:
          process.env.SMTP_FROM || '"Aedra Management" <no-reply@aedra.site>',
        to,
        subject,
        html,
      });
      this.logger.log(`Message sent: ${info.messageId}`);
      return info;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error.message}`);
      throw error;
    }
  }

  generateTodoEmailHtml(name: string, tasks: any[]) {
    const taskRows = tasks
      .map(
        (t) => `
      <li style="margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
        <strong>${t.isCritical ? '🚨 ' : ''}${t.title}</strong><br/>
        <span style="color: #666; font-size: 0.9em;">${t.description}</span>
      </li>
    `,
      )
      .join('');

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #2c3e50;">Habari ${name}, 👋</h2>
        <p>This is your daily to-do list of critical activities for today.</p>
        <ul style="list-style: none; padding: 0;">
          ${taskRows}
        </ul>
        <p style="margin-top: 20px;">Please login to the portal to manage your tasks.</p>
        <hr style="border: 0; border-top: 1px solid #eee;"/>
        <p style="font-size: 0.8em; color: #999;">Aedra Property Management Service</p>
      </div>
    `;
  }
}
