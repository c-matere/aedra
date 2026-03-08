import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';

export interface CreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role?: UserRole;
  companyId?: string;
  permissions?: string[];
  isActive?: boolean;
}

export interface UpdateUserDto {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: UserRole;
  companyId?: string;
  permissions?: string[];
  isActive?: boolean;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) { }

  async findAll(actor: AuthenticatedUser, page = 1, limit = 10, search?: string) {
    const skip = (page - 1) * limit;
    const take = limit;

    const isSuperAdmin = actor.role === UserRole.SUPER_ADMIN;
    if (!isSuperAdmin && !actor.companyId) {
      return {
        data: [],
        meta: {
          total: 0,
          page,
          limit,
          totalPages: 0,
        },
      };
    }

    const where: Prisma.UserWhereInput = {
      ...(isSuperAdmin ? {} : { companyId: actor.companyId }),
      ...(search ? {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ]
      } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: this.safeUserSelect(),
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findAllInvitations(actor: AuthenticatedUser) {
    const isSuperAdmin = actor.role === UserRole.SUPER_ADMIN;

    const where: Prisma.InvitationWhereInput = {
      usedAt: null,
      expiresAt: { gt: new Date() },
      ...(isSuperAdmin ? {} : { companyId: actor.companyId }),
    };

    return this.prisma.invitation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { company: isSuperAdmin },
    });
  }

  async findOne(actor: AuthenticatedUser, id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: this.safeUserSelect(),
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      actor.id !== id &&
      user.companyId !== actor.companyId
    ) {
      throw new ForbiddenException('You cannot access this user.');
    }

    return user;
  }

  async create(actor: AuthenticatedUser, data: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const writeData = this.enforceWritePolicy(actor, data);

    return this.prisma.user.create({
      data: {
        ...writeData,
        password: hashedPassword,
      },
      select: this.safeUserSelect(),
    });
  }

  async update(actor: AuthenticatedUser, id: string, data: UpdateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        companyId: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('User not found.');
    }

    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      actor.id !== id &&
      existing.companyId !== actor.companyId
    ) {
      throw new ForbiddenException('You cannot update this user.');
    }

    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      existing.role === UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException('Only Super Admin can modify Super Admins.');
    }

    const nextData = this.enforceWritePolicy(actor, { ...data });

    if (data.password) {
      nextData.password = await bcrypt.hash(data.password, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data: nextData,
      select: this.safeUserSelect(),
    });
  }

  async remove(actor: AuthenticatedUser, id: string) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        companyId: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('User not found.');
    }

    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      (existing.companyId !== actor.companyId ||
        existing.role === UserRole.SUPER_ADMIN)
    ) {
      throw new ForbiddenException('You cannot delete this user.');
    }

    return this.prisma.user.delete({ where: { id } });
  }

  private enforceWritePolicy<T extends { role?: UserRole; companyId?: string }>(
    actor: AuthenticatedUser,
    data: T,
  ): T {
    if (actor.role === UserRole.SUPER_ADMIN) {
      return data;
    }

    if (!actor.companyId) {
      throw new ForbiddenException('Your account is not linked to a company.');
    }

    if (data.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only Super Admin can assign Super Admin role.',
      );
    }

    if (data.companyId && data.companyId !== actor.companyId) {
      throw new ForbiddenException(
        'You cannot assign users to another company.',
      );
    }

    return {
      ...data,
      companyId: actor.companyId,
    };
  }

  async createInvitation(actor: AuthenticatedUser, data: { email: string; role: UserRole; firstName?: string; lastName?: string }) {
    if (actor.role === UserRole.COMPANY_STAFF) {
      throw new ForbiddenException('Staff members cannot invite users.');
    }

    const token = randomBytes(16).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    return this.prisma.invitation.create({
      data: {
        email: data.email.toLowerCase().trim(),
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        token,
        companyId: actor.companyId ?? undefined,
        expiresAt,
      } as any,
    });
  }

  async verifyInvitation(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: { company: true },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found.');
    }

    if (invitation.usedAt) {
      throw new BadRequestException('Invitation already used.');
    }

    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invitation expired.');
    }

    return invitation;
  }

  async acceptInvitation(token: string, data: { firstName: string; lastName: string; password: string }) {
    const invitation = await this.verifyInvitation(token);
    const hashedPassword = await bcrypt.hash(data.password, 10);

    return this.prisma.$transaction(async (tx) => {
      const inv = invitation as any;
      const user = await tx.user.create({
        data: {
          email: inv.email,
          password: hashedPassword,
          firstName: data.firstName || inv.firstName || '',
          lastName: data.lastName || inv.lastName || '',
          role: inv.role,
          companyId: inv.companyId,
          isActive: true,
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { usedAt: new Date() },
      });

      return user;
    });
  }

  private safeUserSelect() {
    return {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      permissions: true,
      companyId: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    };
  }
}
