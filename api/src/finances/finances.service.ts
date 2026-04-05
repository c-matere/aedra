import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { IncomeCategory, ExpenseCategory } from '@prisma/client';

@Injectable()
export class FinancesService {
  private readonly logger = new Logger(FinancesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOfficeSummary(actor: AuthenticatedUser) {
    const companyId = actor.companyId;
    if (!companyId) return { income: 0, expenses: 0, net: 0 };

    const [incomes, expenses] = await Promise.all([
      this.prisma.income.aggregate({
        where: { companyId, deletedAt: null },
        _sum: { amount: true },
      }),
      this.prisma.expense.aggregate({
        where: {
          companyId,
          propertyId: null, // Only office-level expenses
          deletedAt: null,
        },
        _sum: { amount: true },
      }),
    ]);

    const incomeTotal = incomes._sum.amount || 0;
    const expenseTotal = expenses._sum.amount || 0;

    return {
      income: incomeTotal,
      expenses: expenseTotal,
      net: incomeTotal - expenseTotal,
    };
  }

  async recordCommission(paymentId: string) {
    try {
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          lease: {
            include: {
              property: true,
              tenant: true,
            },
          },
        },
      });

      if (!payment || !payment.lease.property.commissionPercentage) {
        return;
      }

      const commissionAmount =
        (payment.amount * payment.lease.property.commissionPercentage) / 100;

      if (commissionAmount <= 0) return;

      await this.prisma.income.create({
        data: {
          amount: commissionAmount,
          category: IncomeCategory.COMMISSION,
          companyId: payment.lease.tenant.companyId,
          propertyId: payment.lease.propertyId,
          paymentId: payment.id,
          description: `Commission for ${payment.type} payment from ${payment.lease.tenant.firstName} ${payment.lease.tenant.lastName} - Property: ${payment.lease.property.name}`,
          date: payment.paidAt || new Date(),
        },
      });

      this.logger.log(
        `Recorded commission of ${commissionAmount} for payment ${paymentId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to record commission for payment ${paymentId}: ${error.message}`,
      );
    }
  }

  async findAllIncome(actor: AuthenticatedUser) {
    return this.prisma.income.findMany({
      where: { companyId: actor.companyId || undefined, deletedAt: null },
      orderBy: { date: 'desc' },
      include: {
        property: { select: { name: true } },
      },
    });
  }

  async findAllOfficeExpenses(actor: AuthenticatedUser) {
    return this.prisma.expense.findMany({
      where: {
        companyId: actor.companyId || undefined,
        propertyId: null,
        deletedAt: null,
      },
      orderBy: { date: 'desc' },
    });
  }

  async createIncome(
    actor: AuthenticatedUser,
    data: {
      amount: number;
      category: IncomeCategory;
      date: Date;
      description?: string;
      propertyId?: string;
      companyId?: string;
    },
  ) {
    const companyId = data.companyId || actor.companyId;

    if (!companyId) {
      throw new Error('Company ID is required to record income.');
    }

    return this.prisma.income.create({
      data: {
        ...data,
        companyId: companyId,
      },
    });
  }

  async createOfficeExpense(
    actor: AuthenticatedUser,
    data: {
      amount: number;
      category: ExpenseCategory;
      date: Date;
      description: string;
      vendor?: string;
      reference?: string;
      notes?: string;
      companyId?: string;
    },
  ) {
    const companyId = data.companyId || actor.companyId;

    if (!companyId) {
      throw new Error('Company ID is required to record office expense.');
    }

    return this.prisma.expense.create({
      data: {
        ...data,
        companyId: companyId,
        propertyId: null, // Explicitly office-level
        unitId: null,
      },
    });
  }

  async getTenantArrears(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        leases: {
          where: { status: 'ACTIVE', deletedAt: null },
          include: {
            invoices: { where: { deletedAt: null } },
            payments: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!tenant) return 0;

    let totalInvoices = 0;
    let totalPayments = 0;
    for (const lease of tenant.leases) {
      totalInvoices += lease.invoices.reduce((sum, inv) => sum + inv.amount, 0);
      totalPayments += lease.payments.reduce((sum, pay) => sum + pay.amount, 0);
    }

    return totalInvoices - totalPayments;
  }
}
