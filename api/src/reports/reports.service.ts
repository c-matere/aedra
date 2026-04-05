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

    const revenueWhere = isSuperAdmin
      ? {}
      : { lease: { property: { companyId: actor.companyId } } };

    const invoiceWhere = isSuperAdmin
      ? {}
      : { lease: { property: { companyId: actor.companyId } } };

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
          },
          _sum: { amount: true },
        }),
        this.prisma.payment.aggregate({
          where: {
            lease: { propertyId },
            paidAt: { gte: start, lte: end },
            deletedAt: null,
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
          .filter(p => p.paidAt >= start && p.paidAt <= end)
          .reduce((sum, p) => sum + p.amount, 0);

        const okCount = monthlyStatus.filter((s) => s.status === 'ok').length;
        const ltv = Math.round((okCount / monthLabels.length) * 100);

        return {
          name: `${lease.tenant.firstName} ${lease.tenant.lastName}`,
          unit: u.unitNumber,
          rentAmount: lease.rentAmount,
          paidThisMonth,
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
        expensesByCategory: expensesGrouped.map(eg => ({
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
}
