import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';

export interface CreateMaintenanceRequestDto {
  title: string;
  description?: string;
  category?: string;
  priority?: string;
  status?: string;
  estimatedCost?: number;
  actualCost?: number;
  vendor?: string;
  vendorPhone?: string;
  notes?: string;
  propertyId: string;
  unitId?: string;
  assignedToId?: string;
  scheduledAt?: string;
  completedAt?: string;
}

export interface UpdateMaintenanceRequestDto {
  title?: string;
  description?: string;
  category?: string;
  priority?: string;
  status?: string;
  estimatedCost?: number;
  actualCost?: number;
  vendor?: string;
  vendorPhone?: string;
  notes?: string;
  propertyId?: string;
  unitId?: string;
  assignedToId?: string;
  scheduledAt?: string;
  completedAt?: string;
}

@Injectable()
export class MaintenanceRequestsService {
  constructor(private readonly prisma: PrismaService) { }

  async findAll(actor: AuthenticatedUser, page = 1, limit = 10, search?: string) {
    const skip = (page - 1) * limit;
    const take = limit;

    const where: Prisma.MaintenanceRequestWhereInput = {
      ...(actor.role !== 'SUPER_ADMIN' ? { companyId: actor.companyId } : {}),
      ...(search ? {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { vendor: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { property: { name: { contains: search, mode: 'insensitive' } } },
          { unit: { unitNumber: { contains: search, mode: 'insensitive' } } },
        ]
      } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.maintenanceRequest.count({ where }),
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

  async findOne(id: string, actor: AuthenticatedUser) {
    const maintenanceRequest = await this.prisma.maintenanceRequest.findUnique({
      where: { id },
    });

    if (!maintenanceRequest) {
      throw new NotFoundException('Maintenance request not found.');
    }

    if (
      actor.role !== 'SUPER_ADMIN' &&
      maintenanceRequest.companyId !== actor.companyId
    ) {
      throw new ForbiddenException(
        'You cannot access this maintenance request.',
      );
    }

    return maintenanceRequest;
  }

  async create(data: CreateMaintenanceRequestDto, actor: AuthenticatedUser) {
    const companyId = await this.resolveCompanyId(actor);
    await this.validateScope(companyId, data.propertyId, data.unitId);

    const createData: Prisma.MaintenanceRequestUncheckedCreateInput = {
      companyId,
      title: data.title,
      description: data.description,
      category: data.category
        ? this.parseCategory(data.category)
        : MaintenanceCategory.GENERAL,
      priority: data.priority
        ? this.parsePriority(data.priority)
        : MaintenancePriority.MEDIUM,
      status: data.status
        ? this.parseStatus(data.status)
        : MaintenanceStatus.REPORTED,
      estimatedCost: data.estimatedCost,
      actualCost: data.actualCost,
      vendor: data.vendor,
      vendorPhone: data.vendorPhone,
      notes: data.notes,
      propertyId: data.propertyId,
      unitId: data.unitId,
      assignedToId: data.assignedToId,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
    };

    return this.prisma.maintenanceRequest.create({ data: createData });
  }

  async update(
    id: string,
    data: UpdateMaintenanceRequestDto,
    actor: AuthenticatedUser,
  ) {
    const existing = await this.prisma.maintenanceRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Maintenance request not found.');
    }

    if (
      actor.role !== 'SUPER_ADMIN' &&
      existing.companyId !== actor.companyId
    ) {
      throw new ForbiddenException(
        'You cannot update this maintenance request.',
      );
    }

    await this.validateScope(
      existing.companyId,
      data.propertyId ?? existing.propertyId,
      data.unitId ?? existing.unitId ?? undefined,
    );

    const updateData: Prisma.MaintenanceRequestUncheckedUpdateInput = {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined
        ? { description: data.description }
        : {}),
      ...(data.category !== undefined
        ? { category: this.parseCategory(data.category) }
        : {}),
      ...(data.priority !== undefined
        ? { priority: this.parsePriority(data.priority) }
        : {}),
      ...(data.status !== undefined
        ? { status: this.parseStatus(data.status) }
        : {}),
      ...(data.estimatedCost !== undefined
        ? { estimatedCost: data.estimatedCost }
        : {}),
      ...(data.actualCost !== undefined ? { actualCost: data.actualCost } : {}),
      ...(data.vendor !== undefined ? { vendor: data.vendor } : {}),
      ...(data.vendorPhone !== undefined
        ? { vendorPhone: data.vendorPhone }
        : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.propertyId !== undefined ? { propertyId: data.propertyId } : {}),
      ...(data.unitId !== undefined ? { unitId: data.unitId } : {}),
      ...(data.assignedToId !== undefined
        ? { assignedToId: data.assignedToId }
        : {}),
      ...(data.scheduledAt !== undefined
        ? { scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null }
        : {}),
      ...(data.completedAt !== undefined
        ? { completedAt: data.completedAt ? new Date(data.completedAt) : null }
        : {}),
    };

    return this.prisma.maintenanceRequest.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string, actor: AuthenticatedUser) {
    const existing = await this.prisma.maintenanceRequest.findUnique({
      where: { id },
      select: { id: true, companyId: true },
    });

    if (!existing) {
      throw new NotFoundException('Maintenance request not found.');
    }

    if (
      actor.role !== 'SUPER_ADMIN' &&
      existing.companyId !== actor.companyId
    ) {
      throw new ForbiddenException(
        'You cannot delete this maintenance request.',
      );
    }

    return this.prisma.maintenanceRequest.delete({ where: { id } });
  }

  private async resolveCompanyId(actor: AuthenticatedUser): Promise<string> {
    if (actor.companyId) {
      return actor.companyId;
    }

    if (actor.role === 'SUPER_ADMIN') {
      const firstCompany = await this.prisma.company.findFirst({
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      if (firstCompany) {
        return firstCompany.id;
      }
    }

    throw new ForbiddenException('Company context is required.');
  }

  private async validateScope(
    companyId: string,
    propertyId: string,
    unitId?: string,
  ): Promise<void> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, companyId: true },
    });

    if (!property || property.companyId !== companyId) {
      throw new ForbiddenException('Property does not belong to your company.');
    }

    if (!unitId) {
      return;
    }

    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: {
        id: true,
        propertyId: true,
        property: { select: { companyId: true } },
      },
    });

    if (!unit || unit.property.companyId !== companyId) {
      throw new ForbiddenException('Unit does not belong to your company.');
    }

    if (unit.propertyId !== propertyId) {
      throw new BadRequestException(
        'Unit does not belong to selected property.',
      );
    }
  }

  private parseStatus(raw: string): MaintenanceStatus {
    if ((Object.values(MaintenanceStatus) as string[]).includes(raw)) {
      return raw as MaintenanceStatus;
    }

    throw new BadRequestException(`Invalid maintenance status: ${raw}`);
  }

  private parsePriority(raw: string): MaintenancePriority {
    if ((Object.values(MaintenancePriority) as string[]).includes(raw)) {
      return raw as MaintenancePriority;
    }

    throw new BadRequestException(`Invalid maintenance priority: ${raw}`);
  }

  private parseCategory(raw: string): MaintenanceCategory {
    if ((Object.values(MaintenanceCategory) as string[]).includes(raw)) {
      return raw as MaintenanceCategory;
    }

    throw new BadRequestException(`Invalid maintenance category: ${raw}`);
  }
}
