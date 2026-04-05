import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { UserRole } from '../auth/roles.enum';

export class PropertyAssignmentDto {
  userId: string;
  propertyId: string;
}

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async getAssignments(userId: string, actor: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (actor.role !== UserRole.SUPER_ADMIN && user.companyId !== actor.companyId) {
      throw new ForbiddenException('You cannot access this user\'s assignments.');
    }

    return this.prisma.propertyAssignment.findMany({
      where: { userId },
      include: {
        property: {
          select: { id: true, name: true, address: true },
        },
      },
    });
  }

  async assignProperty(data: PropertyAssignmentDto, actor: AuthenticatedUser) {
    const { userId, propertyId } = data;

    // Check if user and property belong to the same company (and match actor's company)
    const [user, property] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } }),
      this.prisma.property.findUnique({ where: { id: propertyId }, select: { companyId: true } }),
    ]);

    if (!user || !property) {
      throw new NotFoundException('User or Property not found.');
    }

    if (user.companyId !== property.companyId) {
      throw new BadRequestException('User and Property must belong to the same company.');
    }

    if (actor.role !== UserRole.SUPER_ADMIN && user.companyId !== actor.companyId) {
      throw new ForbiddenException('You cannot manage assignments for this company.');
    }

    return this.prisma.propertyAssignment.upsert({
      where: {
        userId_propertyId: { userId, propertyId },
      },
      update: {},
      create: {
        userId,
        propertyId,
        companyId: user.companyId,
      },
    });
  }

  async unassignProperty(data: PropertyAssignmentDto, actor: AuthenticatedUser) {
    const { userId, propertyId } = data;

    const assignment = await this.prisma.propertyAssignment.findUnique({
      where: {
        userId_propertyId: { userId, propertyId },
      },
    });

    if (!assignment) {
      return { success: true, message: 'Assignment already removed or never existed.' };
    }

    if (actor.role !== UserRole.SUPER_ADMIN && assignment.companyId !== actor.companyId) {
      throw new ForbiddenException('You cannot manage assignments for this company.');
    }

    await this.prisma.propertyAssignment.delete({
      where: {
        userId_propertyId: { userId, propertyId },
      },
    });

    return { success: true };
  }

  async setBulkAssignments(userId: string, propertyIds: string[], actor: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (actor.role !== UserRole.SUPER_ADMIN && user.companyId !== actor.companyId) {
      throw new ForbiddenException('You cannot manage assignments for this company.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Remove all existing assignments
      await tx.propertyAssignment.deleteMany({
        where: { userId },
      });

      // Create new assignments
      if (propertyIds.length > 0) {
        await tx.propertyAssignment.createMany({
          data: propertyIds.map((propertyId) => ({
            userId,
            propertyId,
            companyId: user.companyId,
          })),
        });
      }

      return this.getAssignments(userId, actor);
    });
  }
}
