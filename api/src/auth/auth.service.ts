import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { createSessionToken } from './session-token';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) { }

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const isPasswordValid = await this.validatePassword(
      password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const accessToken = createSessionToken({
      userId: user.id,
      role: user.role,
      companyId: user.companyId ?? undefined,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        role: user.role,
        companyId: user.companyId ?? undefined,
        email: user.email,
      },
    };
  }

  private async validatePassword(
    plainPassword: string,
    persistedPassword: string,
  ): Promise<boolean> {
    if (!persistedPassword || !persistedPassword.startsWith('$2')) {
      return false;
    }

    try {
      return bcrypt.compare(plainPassword, persistedPassword);
    } catch {
      return false;
    }
  }
}
