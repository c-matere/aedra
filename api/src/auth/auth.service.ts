import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { createSessionToken } from './session-token';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(email: string, password: string) {
    if (!email || typeof email !== 'string') {
      throw new BadRequestException('Email is required and must be a string.');
    }
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

  async registerCompany(data: {
    companyName: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) {
    if (!data.email || typeof data.email !== 'string') {
      throw new BadRequestException('Email is required for registration.');
    }
    if (!data.companyName || !data.password || !data.firstName || !data.lastName) {
      throw new BadRequestException('All fields (companyName, email, password, firstName, lastName) are required.');
    }

    const normalizedEmail = data.email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists.');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create Company and Admin User in a transaction
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: data.companyName,
          email: normalizedEmail,
          isActive: true,
        },
      });

      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          password: hashedPassword,
          firstName: data.firstName,
          lastName: data.lastName,
          role: UserRole.COMPANY_ADMIN,
          companyId: company.id,
          isActive: true,
        },
      });

      const accessToken = createSessionToken({
        userId: user.id,
        role: user.role,
        companyId: company.id,
      });

      return {
        accessToken,
        user: {
          id: user.id,
          role: user.role,
          companyId: company.id,
          email: user.email,
        },
      };
    });
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
