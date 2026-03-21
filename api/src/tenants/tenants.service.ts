import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';

export interface CreateTenantDto {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  idNumber?: string;
  companyId?: string;
  propertyId: string;
}

export interface UpdateTenantDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  idNumber?: string;
  companyId?: string;
  propertyId?: string;
}

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

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

    const where: Prisma.TenantWhereInput = {
      ...(isSuperAdmin ? {} : { companyId: actor.companyId }),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { idNumber: { contains: search, mode: 'insensitive' } },
              { property: { name: { contains: search, mode: 'insensitive' } } },
              {
                property: {
                  address: { contains: search, mode: 'insensitive' },
                },
              },
              {
                leases: {
                  some: {
                    unit: {
                      unitNumber: { contains: search, mode: 'insensitive' },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.tenant.count({ where }),
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
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });

    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }

    if (actor.role !== 'SUPER_ADMIN' && tenant.companyId !== actor.companyId) {
      throw new ForbiddenException('You cannot access this tenant.');
    }

    return tenant;
  }

  async create(data: CreateTenantDto, actor: AuthenticatedUser) {
    if (actor.role !== 'SUPER_ADMIN' && !actor.companyId) {
      throw new ForbiddenException('Your account is not linked to a company.');
    }

    const companyId = await this.resolveCreateCompanyId(data.companyId, actor);

    // Verify property belongs to the company
    const property = await this.prisma.property.findUnique({
      where: { id: data.propertyId },
    });

    if (!property || property.companyId !== companyId) {
      throw new NotFoundException('Property not found or access denied.');
    }

    return this.prisma.tenant.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        idNumber: data.idNumber,
        companyId,
        propertyId: data.propertyId,
      },
    });
  }

  async update(id: string, data: UpdateTenantDto, actor: AuthenticatedUser) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }

    if (actor.role !== 'SUPER_ADMIN' && tenant.companyId !== actor.companyId) {
      throw new ForbiddenException('You cannot update this tenant.');
    }

    return this.prisma.tenant.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, actor: AuthenticatedUser) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }

    if (actor.role !== 'SUPER_ADMIN' && tenant.companyId !== actor.companyId) {
      throw new ForbiddenException('You cannot delete this tenant.');
    }

    return this.prisma.tenant.delete({ where: { id } });
  }

  private async resolveCreateCompanyId(
    requestedCompanyId: string | undefined,
    actor: AuthenticatedUser,
  ): Promise<string> {
    if (actor.companyId) {
      return actor.companyId;
    }

    if (requestedCompanyId) {
      return requestedCompanyId;
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
