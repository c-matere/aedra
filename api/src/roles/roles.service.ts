import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { UserRole } from '../auth/roles.enum';

export class CreateRoleDto {
  name: string;
  description?: string;
  permissions: string[];
}

export class UpdateRoleDto {
  name?: string;
  description?: string;
  permissions?: string[];
}

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: AuthenticatedUser) {
    const isSuperAdmin = actor.role === UserRole.SUPER_ADMIN;

    return this.prisma.role.findMany({
      where: {
        OR: [
          { companyId: actor.companyId },
          { isSystem: true },
          isSuperAdmin ? { companyId: null } : {},
        ].filter(Boolean),
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const role = await this.prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      role.companyId !== actor.companyId &&
      !role.isSystem
    ) {
      throw new ForbiddenException('You cannot access this role.');
    }

    return role;
  }

  async create(data: CreateRoleDto, actor: AuthenticatedUser) {
    const isSuperAdmin = actor.role === UserRole.SUPER_ADMIN;

    // If Super Admin has a non-UUID companyId (like "bench-company-001"),
    // treat it as a system-wide role creation.
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const isValidUuid = actor.companyId && uuidRegex.test(actor.companyId);

    const companyId = isSuperAdmin && !isValidUuid ? null : actor.companyId;
    const isSystem = isSuperAdmin && !isValidUuid;

    if (!companyId && !isSuperAdmin) {
      throw new ForbiddenException('No company ID found for the current user.');
    }

    return this.prisma.role.create({
      data: {
        ...data,
        companyId,
        isSystem,
      },
    });
  }

  async update(id: string, data: UpdateRoleDto, actor: AuthenticatedUser) {
    const role = await this.findOne(id, actor);

    if (role.isSystem && actor.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only Super Admins can update system roles.',
      );
    }

    return this.prisma.role.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, actor: AuthenticatedUser) {
    const role = await this.findOne(id, actor);

    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be deleted.');
    }

    return this.prisma.role.delete({
      where: { id },
    });
  }
}
