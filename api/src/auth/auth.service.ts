import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { createSessionToken } from './session-token';
import { OtpService } from './otp.service';
import { WhatsappService } from '../messaging/whatsapp.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otpService: OtpService,
    private readonly whatsappService: WhatsappService,
  ) {}

  async requestOtp(phone: string) {
    if (!phone) {
      throw new BadRequestException('Phone number is required.');
    }

    // Identify if the phone number belongs to a User, Landlord, or Tenant
    const identified = await this.whatsappService.identifySenderByPhone(phone);
    if (identified.role === 'UNIDENTIFIED') {
      throw new BadRequestException('Phone number not registered.');
    }

    // Generate and send OTP
    const code = await this.otpService.createOtp(phone);

    // Check company preference for WhatsApp OTP
    if (identified.companyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: identified.companyId },
        select: { waOtpEnabled: true },
      });
      if (company && !company.waOtpEnabled) {
        throw new BadRequestException(
          'WhatsApp OTP login is currently disabled by your organization.',
        );
      }
    }

    await this.whatsappService.sendOtp(phone, code, identified.companyId);

    return { success: true, message: 'OTP sent successfully.' };
  }

  async loginWithOtp(phone: string, code: string) {
    if (!phone || !code) {
      throw new BadRequestException('Phone and code are required.');
    }

    const isValid = await this.otpService.verifyOtp(phone, code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired OTP.');
    }

    // Identify user to create token
    const identified = await this.whatsappService.identifySenderByPhone(phone);
    
    // For Tenants and Landlords, we might need to handle their identities specifically 
    // but the identified object already contains id, role, and companyId.
    
    let email = '';
    if (identified.role === 'TENANT') {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: identified.id } });
      email = tenant?.email || `tenant_${identified.id}@aedra.app`;
    } else if (identified.role === 'LANDLORD') {
      const landlord = await this.prisma.landlord.findUnique({ where: { id: identified.id } });
      email = landlord?.email || `landlord_${identified.id}@aedra.app`;
    } else {
      const user = await this.prisma.user.findUnique({ where: { id: identified.id } });
      email = user?.email || 'N/A';
    }

    const accessToken = createSessionToken({
      userId: identified.id,
      role: identified.role as any,
      companyId: identified.companyId ?? undefined,
    });

    return {
      accessToken,
      user: {
        id: identified.id,
        role: identified.role,
        companyId: identified.companyId ?? undefined,
        email: email,
      },
    };
  }

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
    phone?: string;
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
          phone: data.phone,
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
