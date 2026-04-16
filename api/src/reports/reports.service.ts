import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private getWhere(actor: AuthenticatedUser) {
    if (actor.role === 'SUPER_ADMIN') {
      return {};
    }
    if (!actor.companyId) {
      throw new ForbiddenException('Your account is not linked to a company.');
    }
    return { companyId: actor.companyId };
  }

  async getSummary(actor: AuthenticatedUser) {
    const isSuperAdmin = actor.role === 'SUPER_ADMIN';
    if (!isSuperAdmin && !actor.companyId) {
      throw new ForbiddenException('Your account is not linked to a company.');
    }

    const where = isSuperAdmin ? {} : { companyId: actor.companyId };

    const [propertyCount, unitCount, tenantCount, leaseCount] =
      await Promise.all([
        this.prisma.property.count({ where }),
        this.prisma.unit.count({
          where: isSuperAdmin
            ? {}
            : { property: { companyId: actor.companyId } },
        }),
        this.prisma.tenant.count({ where }),
        this.prisma.lease.count({
          where: isSuperAdmin
            ? {}
            : { property: { companyId: actor.companyId } },
        }),
      ]);

    return {
      properties: propertyCount,
      units: unitCount,
      tenants: tenantCount,
      activeLeases: leaseCount,
    };
  }

  async getOccupancy(actor: AuthenticatedUser) {
    const isSuperAdmin = actor.role === 'SUPER_ADMIN';
    if (!isSuperAdmin && !actor.companyId) {
      throw new ForbiddenException('Your account is not linked to a company.');
    }

    const where = isSuperAdmin
      ? {}
      : { property: { companyId: actor.companyId } };

    const statusCounts = await this.prisma.unit.groupBy({
      by: ['status'],
      where,
      _count: {
        id: true,
      },
    });

    const result = {
      VACANT: 0,
      OCCUPIED: 0,
      UNDER_MAINTENANCE: 0,
      VACATING: 0,
    };

    statusCounts.forEach((item) => {
      result[item.status as keyof typeof result] = item._count.id;
    });

    return result;
  }

  async getRevenue(actor: AuthenticatedUser) {
    const isSuperAdmin = actor.role === 'SUPER_ADMIN';
    if (!isSuperAdmin && !actor.companyId) {
      throw new ForbiddenException('Your account is not linked to a company.');
    }

    const revenueWhere: any = isSuperAdmin
      ? {}
      : { lease: { property: { companyId: actor.companyId } } };
    revenueWhere.type = { notIn: ['PENALTY', 'AGREEMENT_FEE'] };

    const invoiceWhere: any = isSuperAdmin
      ? {}
      : { lease: { property: { companyId: actor.companyId } } };
    invoiceWhere.type = { notIn: ['PENALTY', 'AGREEMENT_FEE'] };

    const [totalRevenue, totalInvoiced] = await Promise.all([
      this.prisma.payment.aggregate({
        where: revenueWhere,
        _sum: {
          amount: true,
        },
      }),
      this.prisma.invoice.aggregate({
        where: invoiceWhere,
        _sum: {
          amount: true,
        },
      }),
    ]);

    const paid = totalRevenue._sum.amount || 0;
    const billed = totalInvoiced._sum.amount || 0;

    return {
      totalRevenue: paid,
      totalInvoiced: billed,
      unpaidBalance: billed - paid,
    };
  }

  async getPortfolioData(
    propertyId: string,
    actor: AuthenticatedUser,
    dateFrom?: Date,
    dateTo?: Date,
  ) {
    const isSuperAdmin = actor.role === 'SUPER_ADMIN';
    const where: any = { id: propertyId };
    if (!isSuperAdmin) {
      if (!actor.companyId) throw new ForbiddenException('No company linked.');
      where.companyId = actor.companyId;
    }

    const start = dateFrom || new Date();
    if (!dateFrom) {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    }
    const end = dateTo || new Date();

    const historyStart = new Date(start);
    historyStart.setMonth(historyStart.getMonth() - 4);
    historyStart.setDate(1);

    const property = await this.prisma.property.findFirst({
      where,
      include: {
        units: {
          where: { deletedAt: null },
          include: {
            leases: {
              where: { status: 'ACTIVE', deletedAt: null },
              include: {
                tenant: true,
                payments: {
                  where: {
                    deletedAt: null,
                    paidAt: { gte: historyStart, lte: end },
                    type: { notIn: ['PENALTY', 'AGREEMENT_FEE'] },
                  },
                  orderBy: { paidAt: 'desc' },
                },
              },
            },
          },
        },
        landlord: true,
      },
    });

    if (!property)
      throw new ForbiddenException('Property not found or access denied.');

    const totalUnits = property.units.length;
    const occupiedUnits = property.units.filter(
      (u) => u.status === 'OCCUPIED',
    ).length;
    const occupancyRate =
      totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

    const [invoicesAgg, paymentsAgg, expensesAgg, payMethods] =
      await Promise.all([
        this.prisma.invoice.aggregate({
          where: {
            lease: { propertyId },
            createdAt: { gte: start, lte: end },
            deletedAt: null,
            type: { notIn: ['PENALTY', 'AGREEMENT_FEE'] },
          },
          _sum: { amount: true },
        }),
        this.prisma.payment.aggregate({
          where: {
            lease: { propertyId },
            paidAt: { gte: start, lte: end },
            deletedAt: null,
            type: { notIn: ['PENALTY', 'AGREEMENT_FEE'] },
          },
          _sum: { amount: true },
        }),
        this.prisma.expense.aggregate({
          where: {
            propertyId,
            date: { gte: start, lte: end },
            deletedAt: null,
          },
          _sum: { amount: true },
        }),
        this.prisma.payment.groupBy({
          by: ['method'],
          where: {
            lease: { propertyId },
            paidAt: { gte: start, lte: end },
            deletedAt: null,
          },
          _count: true,
        }),
      ]);

    const maintenanceStats = await this.prisma.maintenanceRequest.groupBy({
      by: ['status'],
      where: { propertyId, deletedAt: null },
      _count: true,
    });

    const openMaintenance = maintenanceStats
      .filter((s) =>
        ['REPORTED', 'IN_PROGRESS', 'ACKNOWLEDGED', 'OPEN'].includes(s.status),
      )
      .reduce((acc, curr) => acc + curr._count, 0);

    const resolvedMaintenance = maintenanceStats
      .filter((s) => s.status === 'COMPLETED')
      .reduce((acc, curr) => acc + curr._count, 0);

    // Prepare 5 months of labels
    const monthLabels: string[] = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date(start);
      d.setMonth(d.getMonth() - i);
      monthLabels.push(d.toLocaleString('en-US', { month: 'short' }));
    }
    
    // Fetch historical cumulative balances per lease (excluding penalties)
    const [histInvoices, histPayments] = await Promise.all([
      this.prisma.invoice.groupBy({
        by: ['leaseId'],
        where: {
          lease: { propertyId },
          deletedAt: null,
          type: { notIn: ['PENALTY', 'AGREEMENT_FEE'] },
        },
        _sum: { amount: true },
      }),
      this.prisma.payment.groupBy({
        by: ['leaseId'],
        where: {
          lease: { propertyId },
          deletedAt: null,
          type: { notIn: ['PENALTY', 'AGREEMENT_FEE'] },
        },
        _sum: { amount: true },
      }),
    ]);

    const invoiceMap = new Map(histInvoices.map(i => [i.leaseId, i._sum.amount || 0]));
    const paymentMap = new Map(histPayments.map(p => [p.leaseId, p._sum.amount || 0]));

    const tenantPayments = property.units
      .filter((u) => u.leases.length > 0)
      .map((u) => {
        const lease = u.leases[0];
        const monthlyStatus = monthLabels.map((label) => {
          const hasPayment = lease.payments.some(
            (p) =>
              p.paidAt.toLocaleString('en-US', { month: 'short' }) === label,
          );
          return { month: label, status: hasPayment ? 'ok' : 'missed' };
        });

        const paidThisMonth = lease.payments
          .filter((p) => p.paidAt >= start && p.paidAt <= end)
          .reduce((sum, p) => sum + p.amount, 0);

        const totalInvoiced = invoiceMap.get(lease.id) || 0;
        const totalPaid = paymentMap.get(lease.id) || 0;
        const totalBalance = totalInvoiced - totalPaid;

        const okCount = monthlyStatus.filter((s) => s.status === 'ok').length;
        const ltv = Math.round((okCount / monthLabels.length) * 100);

        return {
          name: `${lease.tenant.firstName} ${lease.tenant.lastName}`,
          unit: u.unitNumber,
          rentAmount: lease.rentAmount,
          paidThisMonth,
          totalBalance,
          payments: monthlyStatus,
          ltv,
        };
      });

    const expensesGrouped = await this.prisma.expense.groupBy({
      by: ['category'],
      where: {
        propertyId,
        date: { gte: start, lte: end },
        deletedAt: null,
      },
      _sum: { amount: true },
    });

    const user = await this.prisma.user.findUnique({ where: { id: actor.id } });

    return {
      property: {
        id: property.id,
        name: property.name,
        manager: user
          ? `${user.firstName} ${user.lastName}`
          : 'Aedra Resident Manager',
        address: property.address,
        commissionPercentage: property.commissionPercentage,
      },
      totals: {
        occupancy: occupancyRate,
        invoices: invoicesAgg._sum.amount || 0,
        payments: paymentsAgg._sum.amount || 0,
        expenses: expensesAgg._sum.amount || 0,
        units: totalUnits,
        occupied: occupiedUnits,
        expensesByCategory: expensesGrouped.map((eg) => ({
          category: eg.category,
          amount: eg._sum.amount || 0,
        })),
      },
      maintenance: {
        open: openMaintenance,
        resolved: resolvedMaintenance,
      },
      paymentMethods: payMethods.map((pm) => ({
        method: pm.method || 'Other',
        count: pm._count,
      })),
      tenantPayments,
      occupancyHistory: [
        {
          month: 'Last Month',
          value: occupancyRate - 2 > 0 ? occupancyRate - 2 : 0,
        },
        { month: 'Current', value: occupancyRate },
      ],
      month: start.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    };
  }

  async getTenantStatement(
    leaseId: string,
    actor: AuthenticatedUser,
    startDate?: Date,
    endDate?: Date,
  ) {
    const isSuperAdmin = actor.role === 'SUPER_ADMIN';
    const start = startDate || new Date(0);
    const end = endDate || new Date();

    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      include: {
        tenant: true,
        unit: {
          select: {
            unitNumber: true,
            propertyId: true,
          },
        },
        property: {
          include: {
            company: true,
          },
        },
      },
    });

    if (!lease) throw new Error('Lease not found.');
    if (!isSuperAdmin && lease.property.companyId !== actor.companyId) {
      throw new ForbiddenException('Access denied.');
    }

    // Opening Balance Calculation
    const [priorInvoices, priorPayments] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { leaseId, createdAt: { lt: start }, deletedAt: null },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { leaseId, paidAt: { lt: start }, deletedAt: null },
        _sum: { amount: true },
      }),
    ]);

    const openingBalance =
      (priorInvoices._sum.amount || 0) - (priorPayments._sum.amount || 0);

    // Fetch Transactions in Range
    const [invoices, payments] = await Promise.all([
      this.prisma.invoice.findMany({
        where: {
          leaseId,
          createdAt: { gte: start, lte: end },
          deletedAt: null,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.payment.findMany({
        where: { leaseId, paidAt: { gte: start, lte: end }, deletedAt: null },
        orderBy: { paidAt: 'asc' },
      }),
    ]);

    // Combine and sort
    const transactions = [
      ...invoices.map((inv) => ({
        id: inv.id,
        date: inv.createdAt,
        code: `INV-${inv.id.slice(0, 8).toUpperCase()}`,
        description: inv.description,
        debit: inv.amount,
        credit: 0,
        type: inv.type,
      })),
      ...payments.map((p) => ({
        id: p.id,
        date: p.paidAt,
        code: `RCT-${p.id.slice(0, 8).toUpperCase()}`,
        description: p.notes || `Payment for ${p.type} via ${p.method}`,
        debit: 0,
        credit: p.amount,
        type: p.type,
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate Running Balance
    let currentBalance = openingBalance;
    const ledger = transactions.map((t) => {
      currentBalance += t.debit - t.credit;
      return { ...t, balance: currentBalance };
    });

    // Summaries
    const invoiceSummary = invoices.reduce(
      (acc, inv) => {
        acc[inv.type] = (acc[inv.type] || 0) + inv.amount;
        return acc;
      },
      {} as Record<string, number>,
    );

    const paymentSummary = payments.reduce(
      (acc, p) => {
        acc[p.type] = (acc[p.type] || 0) + p.amount;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      company: lease.property.company,
      tenant: lease.tenant,
      property: lease.property,
      unit: lease.unit,
      lease: {
        id: lease.id,
        startDate: lease.startDate,
        endDate: lease.endDate,
        rentAmount: lease.rentAmount,
        deposit: lease.deposit,
        status: lease.status,
      },
      range: { start, end },
      openingBalance,
      closingBalance: currentBalance,
      ledger,
      summaries: {
        invoices: Object.entries(invoiceSummary).map(([type, amount]) => ({
          type,
          amount,
        })),
        payments: Object.entries(paymentSummary).map(([type, amount]) => ({
          type,
          amount,
        })),
      },
    };
  }
}
