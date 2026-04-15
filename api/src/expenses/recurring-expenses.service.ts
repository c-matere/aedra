import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { ExpenseCategory, Prisma } from '@prisma/client';
import {
  CreateRecurringExpenseDto,
  UpdateRecurringExpenseDto,
} from './dto/recurring-expense.dto';

@Injectable()
export class RecurringExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: AuthenticatedUser, propertyId?: string) {
    const isSuperAdmin = actor.role === 'SUPER_ADMIN';
    if (!isSuperAdmin && !actor.companyId) {
      return [];
    }

    return this.prisma.recurringExpense.findMany({
      where: {
        ...(isSuperAdmin ? {} : { companyId: actor.companyId }),
        ...(propertyId ? { propertyId } : {}),
      },
      include: {
        property: { select: { name: true } },
      },
      orderBy: { dayOfMonth: 'asc' },
    });
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const record = await this.prisma.recurringExpense.findUnique({
      where: { id },
    });
    if (!record) {
      throw new NotFoundException('Recurring expense not found.');
    }

    if (actor.role !== 'SUPER_ADMIN' && record.companyId !== actor.companyId) {
      throw new ForbiddenException('You cannot access this record.');
    }

    return record;
  }

  async create(data: CreateRecurringExpenseDto, actor: AuthenticatedUser) {
    const companyId = await this.resolveCompanyId(actor);
    await this.validateProperty(companyId, data.propertyId);

    return this.prisma.recurringExpense.create({
      data: {
        companyId,
        propertyId: data.propertyId,
        description: data.description,
        amount: data.amount,
        dayOfMonth: data.dayOfMonth,
        category: data.category ? this.parseCategory(data.category) : 'OTHER',
        isActive: true,
      },
    });
  }

  async update(
    id: string,
    data: UpdateRecurringExpenseDto,
    actor: AuthenticatedUser,
  ) {
    const existing = await this.findOne(id, actor);

    return this.prisma.recurringExpense.update({
      where: { id },
      data: {
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.amount !== undefined ? { amount: data.amount } : {}),
        ...(data.dayOfMonth !== undefined
          ? { dayOfMonth: data.dayOfMonth }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.category !== undefined
          ? { category: this.parseCategory(data.category) }
          : {}),
      },
    });
  }

  async remove(id: string, actor: AuthenticatedUser) {
    await this.findOne(id, actor);
    return this.prisma.recurringExpense.delete({ where: { id } });
  }

  private async resolveCompanyId(actor: AuthenticatedUser): Promise<string> {
    if (actor.companyId) return actor.companyId;
    if (actor.role === 'SUPER_ADMIN') {
      const first = await this.prisma.company.findFirst({
        select: { id: true },
      });
      if (first) return first.id;
    }
    throw new ForbiddenException('Company context is required.');
  }

  private async validateProperty(companyId: string, propertyId: string) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { companyId: true },
    });
    if (!property || property.companyId !== companyId) {
      throw new ForbiddenException('Invalid property for your company.');
    }
  }

  private parseCategory(raw: string): ExpenseCategory {
    if ((Object.values(ExpenseCategory) as string[]).includes(raw)) {
      return raw as ExpenseCategory;
    }
    throw new BadRequestException(`Invalid expense category: ${raw}`);
  }
}
