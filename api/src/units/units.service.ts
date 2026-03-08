import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, UnitStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';

export interface CreateUnitDto {
  unitNumber: string;
  floor?: string;
  bedrooms?: number;
  bathrooms?: number;
  sizeSqm?: number;
  rentAmount?: number;
  propertyId: string;
  status?: UnitStatus;
}

export interface UpdateUnitDto {
  unitNumber?: string;
  floor?: string;
  bedrooms?: number;
  bathrooms?: number;
  sizeSqm?: number;
  rentAmount?: number;
  propertyId?: string;
  status?: UnitStatus;
}

@Injectable()
export class UnitsService {
  constructor(private readonly prisma: PrismaService) { }

  async findAll(
    actor: AuthenticatedUser,
    page = 1,
    limit = 10,
    search?: string,
  ) {
    const skip = (page - 1) * limit;
    const take = limit;

    const isSuperAdmin = actor.role === 'SUPER_ADMIN';
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

    const where: Prisma.UnitWhereInput = {
      property: isSuperAdmin ? {} : { companyId: actor.companyId },
      ...(search
        ? {
          OR: [
            { unitNumber: { contains: search, mode: 'insensitive' } },
            { floor: { contains: search, mode: 'insensitive' } },
            { property: { name: { contains: search, mode: 'insensitive' } } },
            {
              property: {
                address: { contains: search, mode: 'insensitive' },
              },
            },
            {
              property: {
                landlord: {
                  OR: [
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } },
                  ],
                },
              },
            },
            {
              leases: {
                some: {
                  tenant: {
                    OR: [
                      {
                        firstName: { contains: search, mode: 'insensitive' },
                      },
                      { lastName: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            },
          ],
        }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.unit.findMany({
        where,
        include: {
          property: { select: { id: true, name: true, companyId: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.unit.count({ where }),
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
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: {
        property: {
          select: { id: true, name: true, companyId: true, address: true },
        },
        leases: {
          include: {
            tenant: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
            payments: { orderBy: { createdAt: 'desc' } },
            invoices: { orderBy: { dueDate: 'desc' } },
          },
          orderBy: { startDate: 'desc' },
        },
      },
    });

    if (!unit) {
      throw new NotFoundException('Unit not found.');
    }

    if (
      actor.role !== 'SUPER_ADMIN' &&
      unit.property.companyId !== actor.companyId
    ) {
      throw new ForbiddenException('You cannot access this unit.');
    }

    // Calculate balances for each lease in the unit
    const leasesWithBalances = await Promise.all(
      unit.leases.map(async (lease) => {
        const billed = lease.invoices.reduce((sum, inv) => sum + inv.amount, 0);
        const paid = lease.payments.reduce((sum, pmt) => sum + pmt.amount, 0);
        return {
          ...lease,
          balance: billed - paid,
        };
      }),
    );

    return {
      ...unit,
      leases: leasesWithBalances,
    };
  }

  async create(data: CreateUnitDto, actor: AuthenticatedUser) {
    const property = await this.prisma.property.findUnique({
      where: { id: data.propertyId },
      select: { id: true, companyId: true },
    });

    if (!property) {
      throw new NotFoundException('Property not found.');
    }

    if (
      actor.role !== 'SUPER_ADMIN' &&
      property.companyId !== actor.companyId
    ) {
      throw new ForbiddenException(
        'You cannot create units for this property.',
      );
    }

    return this.prisma.unit.create({
      data: data as any,
      include: {
        property: { select: { id: true, name: true, companyId: true } },
      },
    });
  }

  async update(id: string, data: UpdateUnitDto, actor: AuthenticatedUser) {
    const existing = await this.prisma.unit.findUnique({
      where: { id },
      include: { property: { select: { id: true, companyId: true } } },
    });

    if (!existing) {
      throw new NotFoundException('Unit not found.');
    }

    if (
      actor.role !== 'SUPER_ADMIN' &&
      existing.property.companyId !== actor.companyId
    ) {
      throw new ForbiddenException('You cannot update this unit.');
    }

    if (data.propertyId) {
      const nextProperty = await this.prisma.property.findUnique({
        where: { id: data.propertyId },
        select: { id: true, companyId: true },
      });

      if (!nextProperty) {
        throw new NotFoundException('Target property not found.');
      }

      if (
        actor.role !== 'SUPER_ADMIN' &&
        nextProperty.companyId !== actor.companyId
      ) {
        throw new ForbiddenException('You cannot move unit to that property.');
      }
    }

    return this.prisma.unit.update({
      where: { id },
      data: data as any,
      include: {
        property: { select: { id: true, name: true, companyId: true } },
      },
    });
  }

  async remove(id: string, actor: AuthenticatedUser) {
    const existing = await this.prisma.unit.findUnique({
      where: { id },
      include: { property: { select: { companyId: true } } },
    });

    if (!existing) {
      throw new NotFoundException('Unit not found.');
    }

    if (
      actor.role !== 'SUPER_ADMIN' &&
      existing.property.companyId !== actor.companyId
    ) {
      throw new ForbiddenException('You cannot delete this unit.');
    }

    return this.prisma.unit.delete({ where: { id } });
  }
}
