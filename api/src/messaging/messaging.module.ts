import { Module, forwardRef } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { RemindersService } from './reminders.service';
import { UnitsModule } from '../units/units.module';
import { EmailService } from './email.service';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    PrismaModule,
    UnitsModule,
    CacheModule.register(),
    forwardRef(() => AiModule),
  ],
  providers: [WhatsappService, RemindersService, EmailService],
  controllers: [WhatsappController],
  exports: [WhatsappService, RemindersService, EmailService],
})
export class MessagingModule {}
