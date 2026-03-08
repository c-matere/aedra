import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../auth/roles.enum';
import * as bcrypt from 'bcryptjs';
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

    const where: Prisma.UserWhereInput = {
      ...(actor.role !== UserRole.SUPER_ADMIN ? { companyId: actor.companyId } : {}),
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
