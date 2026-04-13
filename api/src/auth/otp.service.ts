import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a 6-digit OTP code.
   */
  generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Creates an OTP record in the database.
   * Expiry is set to 10 minutes by default.
   */
  async createOtp(phone: string): Promise<string> {
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.prisma.otp.create({
      data: {
        phone,
        code,
        expiresAt,
      },
    });

    this.logger.log(`OTP generated for ${phone}`);
    return code;
  }

  /**
   * Verifies an OTP code.
   * Returns true if valid, false otherwise.
   */
  async verifyOtp(phone: string, code: string): Promise<boolean> {
    const otp = await this.prisma.otp.findFirst({
      where: {
        phone,
        code,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otp) {
      return false;
    }

    // Mark as used
    await this.prisma.otp.update({
      where: { id: otp.id },
      data: { usedAt: new Date() },
    });

    return true;
  }
}
