import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OtpService } from './otp.service';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [UsersModule, PrismaModule, MessagingModule],
  controllers: [AuthController],
  providers: [AuthService, OtpService],
  exports: [AuthService],
})
export class AuthModule {}
