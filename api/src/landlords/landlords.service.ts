import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';

export interface CreateLandlordDto {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  idNumber?: string;
  address?: string;
}

export interface UpdateLandlordDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  idNumber?: string;
  address?: string;
}

@Injectable()
export class LandlordsService {
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

    const where: Prisma.LandlordWhereInput = {
      ...(isSuperAdmin ? {} : { companyId: actor.companyId }),
      ...(search
        ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { idNumber: { contains: search, mode: 'insensitive' } },
            {
              properties: {
                some: { name: { contains: search, mode: 'insensitive' } },
              },
            },
          ],
        }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.landlord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.landlord.count({ where }),
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
    const landlord = await this.prisma.landlord.findUnique({ where: { id } });
    if (!landlord) {
      throw new NotFoundException('Landlord not found.');
    }

    if (
      actor.role !== 'SUPER_ADMIN' &&
      landlord.companyId !== actor.companyId
    ) {
      throw new ForbiddenException('You cannot access this landlord.');
    }

    return landlord;
  }

  async create(data: CreateLandlordDto, actor: AuthenticatedUser) {
    const companyId = await this.resolveCompanyId(actor);

    return this.prisma.landlord.create({
      data: {
        ...data,
        companyId,
      },
    });
  }

  async update(id: string, data: UpdateLandlordDto, actor: AuthenticatedUser) {
    const landlord = await this.prisma.landlord.findUnique({ where: { id } });
    if (!landlord) {
      throw new NotFoundException('Landlord not found.');
    }

    if (
      actor.role !== 'SUPER_ADMIN' &&
      landlord.companyId !== actor.companyId
    ) {
      throw new ForbiddenException('You cannot update this landlord.');
    }

    return this.prisma.landlord.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, actor: AuthenticatedUser) {
    const landlord = await this.prisma.landlord.findUnique({ where: { id } });
    if (!landlord) {
      throw new NotFoundException('Landlord not found.');
    }

    if (
      actor.role !== 'SUPER_ADMIN' &&
      landlord.companyId !== actor.companyId
    ) {
      throw new ForbiddenException('You cannot delete this landlord.');
    }

    return this.prisma.landlord.delete({ where: { id } });
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
}
