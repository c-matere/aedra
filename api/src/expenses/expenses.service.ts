import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { ExpenseCategory, Prisma } from '@prisma/client';

export interface CreateExpenseDto {
  description: string;
  amount: number;
  category?: string;
  vendor?: string;
  reference?: string;
  notes?: string;
  propertyId?: string;
  unitId?: string;
}

export interface UpdateExpenseDto {
  description?: string;
  amount?: number;
  category?: string;
  vendor?: string;
  reference?: string;
  notes?: string;
  propertyId?: string;
  unitId?: string;
}

@Injectable()
export class ExpensesService {
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

    const where: Prisma.ExpenseWhereInput = {
      ...(isSuperAdmin ? {} : { companyId: actor.companyId }),
      ...(search
        ? {
            OR: [
              { description: { contains: search, mode: 'insensitive' } },
              { vendor: { contains: search, mode: 'insensitive' } },
              { reference: { contains: search, mode: 'insensitive' } },
              { property: { name: { contains: search, mode: 'insensitive' } } },
              {
                unit: { unitNumber: { contains: search, mode: 'insensitive' } },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.expense.count({ where }),
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
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) {
      throw new NotFoundException('Expense not found.');
    }

    if (actor.role !== 'SUPER_ADMIN' && expense.companyId !== actor.companyId) {
      throw new ForbiddenException('You cannot access this expense.');
    }

    return expense;
  }

  async create(data: CreateExpenseDto, actor: AuthenticatedUser) {
    const companyId = await this.resolveCompanyId(actor);
    await this.validateRefs(companyId, data.propertyId, data.unitId);

    const createData: Prisma.ExpenseUncheckedCreateInput = {
      companyId,
      description: data.description,
      amount: data.amount,
      vendor: data.vendor,
      reference: data.reference,
      notes: data.notes,
      propertyId: data.propertyId,
      unitId: data.unitId,
      ...(data.category ? { category: this.parseCategory(data.category) } : {}),
    };

    return this.prisma.expense.create({
      data: createData,
    });
  }

  async update(id: string, data: UpdateExpenseDto, actor: AuthenticatedUser) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) {
      throw new NotFoundException('Expense not found.');
    }

    if (actor.role !== 'SUPER_ADMIN' && expense.companyId !== actor.companyId) {
      throw new ForbiddenException('You cannot update this expense.');
    }

    const companyId = expense.companyId;
    await this.validateRefs(
      companyId,
      data.propertyId ?? expense.propertyId ?? undefined,
      data.unitId ?? expense.unitId ?? undefined,
    );

    const updateData: Prisma.ExpenseUncheckedUpdateInput = {
      ...(data.description !== undefined
        ? { description: data.description }
        : {}),
      ...(data.amount !== undefined ? { amount: data.amount } : {}),
      ...(data.vendor !== undefined ? { vendor: data.vendor } : {}),
      ...(data.reference !== undefined ? { reference: data.reference } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.propertyId !== undefined ? { propertyId: data.propertyId } : {}),
      ...(data.unitId !== undefined ? { unitId: data.unitId } : {}),
      ...(data.category !== undefined
        ? { category: this.parseCategory(data.category) }
        : {}),
    };

    return this.prisma.expense.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string, actor: AuthenticatedUser) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) {
      throw new NotFoundException('Expense not found.');
    }

    if (actor.role !== 'SUPER_ADMIN' && expense.companyId !== actor.companyId) {
      throw new ForbiddenException('You cannot delete this expense.');
    }

    return this.prisma.expense.delete({ where: { id } });
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

  private async validateRefs(
    companyId: string,
    propertyId?: string,
    unitId?: string,
  ): Promise<void> {
    if (propertyId) {
      const property = await this.prisma.property.findUnique({
        where: { id: propertyId },
        select: { id: true, companyId: true },
      });

      if (!property || property.companyId !== companyId) {
        throw new ForbiddenException(
          'Property does not belong to your company.',
        );
      }
    }

    if (unitId) {
      const unit = await this.prisma.unit.findUnique({
        where: { id: unitId },
        include: { property: { select: { companyId: true, id: true } } },
      });

      if (!unit || unit.property.companyId !== companyId) {
        throw new ForbiddenException('Unit does not belong to your company.');
      }

      if (propertyId && unit.property.id !== propertyId) {
        throw new ForbiddenException(
          'Unit does not belong to selected property.',
        );
      }
    }
  }

  private parseCategory(raw: string): ExpenseCategory {
    if ((Object.values(ExpenseCategory) as string[]).includes(raw)) {
      return raw as ExpenseCategory;
    }

    throw new BadRequestException(`Invalid expense category: ${raw}`);
  }
}
