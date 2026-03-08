import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';

import { PropertyType, Prisma } from '@prisma/client';

export interface CreatePropertyDto {
  name: string;
  address?: string;
  propertyType?: PropertyType;
  description?: string;
  landlord?: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
  };
  unitBatches?: {
    prefix: string;
    count: number;
    bedrooms?: number;
    bathrooms?: number;
    rentAmount?: number;
  }[];
}

export interface UpdatePropertyDto {
  name?: string;
  address?: string;
  propertyType?: PropertyType;
  description?: string;
}

@Injectable()
export class PropertiesService {
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

    const where: Prisma.PropertyWhereInput = {
      ...(isSuperAdmin ? {} : { companyId: actor.companyId }),
      ...(search
        ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { address: { contains: search, mode: 'insensitive' } },
            {
              landlord: {
                OR: [
                  { firstName: { contains: search, mode: 'insensitive' } },
                  { lastName: { contains: search, mode: 'insensitive' } },
                ],
              },
            },
            {
              units: {
                some: {
                  unitNumber: { contains: search, mode: 'insensitive' },
                },
              },
            },
          ],
        }
        : {}),
    };

    const [rawProperties, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        select: {
          id: true,
          name: true,
          address: true,
          propertyType: true,
          description: true,
          units: {
            select: {
              status: true,
              rentAmount: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.property.count({ where }),
    ]);

    const data = rawProperties.map((p) => {
      const totalUnits = p.units.length;
      const occupiedUnits = p.units.filter(
        (u) => u.status === 'OCCUPIED' || u.status === 'VACATING',
      ).length;
      const vacatingUnits = p.units.filter(
        (u) => u.status === 'VACATING',
      ).length;
      const monthlyRevenue = p.units
        .filter((u) => u.status === 'OCCUPIED' || u.status === 'VACATING')
        .reduce((sum, u) => sum + (u.rentAmount || 0), 0);

      const { units, ...rest } = p;
      return {
        ...rest,
        totalUnits,
        occupiedUnits,
        vacatingUnits,
        monthlyRevenue,
      };
    });

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
    const property = await this.prisma.property.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        address: true,
        propertyType: true,
        description: true,
        companyId: true,
        landlord: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        units: {
          select: {
            id: true,
            unitNumber: true,
            status: true,
            rentAmount: true,
            bedrooms: true,
            bathrooms: true,
          },
        },
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found.');
    }

    if (
      actor.role !== 'SUPER_ADMIN' &&
      property.companyId !== actor.companyId
    ) {
      throw new ForbiddenException('You cannot access this property.');
    }

    const totalUnits = property.units.length;
    const occupiedUnits = property.units.filter(
      (u) => u.status === 'OCCUPIED' || u.status === 'VACATING',
    ).length;
    const vacatingUnits = property.units.filter(
      (u) => u.status === 'VACATING',
    ).length;
    const monthlyRevenue = property.units
      .filter((u) => u.status === 'OCCUPIED' || u.status === 'VACATING')
      .reduce((sum, u) => sum + (u.rentAmount || 0), 0);

    return {
      ...property,
      totalUnits,
      occupiedUnits,
      vacatingUnits,
      monthlyRevenue,
    };
  }

  async create(data: CreatePropertyDto, actor: AuthenticatedUser) {
    if (actor.role !== 'SUPER_ADMIN' && !actor.companyId) {
      throw new ForbiddenException('Your account is not linked to a company.');
    }

    const companyId = await this.resolveCreateCompanyId(actor);

    return this.prisma.$transaction(async (tx) => {
      let landlordId: string;

      if (data.landlord) {
        // Create new landlord
        const newLandlord = await tx.landlord.create({
          data: {
            ...data.landlord,
            companyId,
          },
        });
        landlordId = newLandlord.id;
      } else {
        // Fallback to first existing landlord for this company
        const existingLandlord = await tx.landlord.findFirst({
          where: { companyId },
          select: { id: true },
          orderBy: { createdAt: 'asc' },
        });

        if (!existingLandlord) {
          throw new ForbiddenException(
            'No landlord exists for this company. Please provide landlord details.',
          );
        }
        landlordId = existingLandlord.id;
      }

      // Create Property
      const property = await tx.property.create({
        data: {
          name: data.name,
          address: data.address,
          propertyType: data.propertyType,
          description: data.description,
          companyId,
          landlordId,
        },
        select: {
          id: true,
          name: true,
          address: true,
          propertyType: true,
          description: true,
        },
      });

      // Generate Units if batches are defined
      if (data.unitBatches && data.unitBatches.length > 0) {
        const unitsData = [];
        for (const batch of data.unitBatches) {
          for (let i = 1; i <= batch.count; i++) {
            unitsData.push({
              propertyId: property.id,
              unitNumber: `${batch.prefix} ${i}`,
              bedrooms: batch.bedrooms,
              bathrooms: batch.bathrooms,
              rentAmount: batch.rentAmount,
            });
          }
        }
        if (unitsData.length > 0) {
          await tx.unit.createMany({
            data: unitsData,
          });
        }
      }

      return property;
    });
  }

  async update(id: string, data: UpdatePropertyDto, actor: AuthenticatedUser) {
    const property = await this.prisma.property.findUnique({
      where: { id },
      select: {
        id: true,
        companyId: true,
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found.');
    }

    if (
      actor.role !== 'SUPER_ADMIN' &&
      property.companyId !== actor.companyId
    ) {
      throw new ForbiddenException('You cannot update this property.');
    }

    return this.prisma.property.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        address: true,
        propertyType: true,
        description: true,
      },
    });
  }

  async remove(id: string, actor: AuthenticatedUser) {
    const property = await this.prisma.property.findUnique({
      where: { id },
      select: {
        id: true,
        companyId: true,
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found.');
    }

    if (
      actor.role !== 'SUPER_ADMIN' &&
      property.companyId !== actor.companyId
    ) {
      throw new ForbiddenException('You cannot delete this property.');
    }

    return this.prisma.property.delete({ where: { id } });
  }

  private async resolveCreateCompanyId(
    actor: AuthenticatedUser,
  ): Promise<string> {
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
}
