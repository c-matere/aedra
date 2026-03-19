import { Module, forwardRef } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { RemindersService } from './reminders.service';
import { UnitsModule } from '../units/units.module';

@Module({
  imports: [PrismaModule, UnitsModule, forwardRef(() => AiModule)],
  providers: [WhatsappService, RemindersService],
  controllers: [WhatsappController],
  exports: [WhatsappService, RemindersService],
})
export class MessagingModule {}
