import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) { }

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
          where: isSuperAdmin ? {} : { property: { companyId: actor.companyId } },
        }),
        this.prisma.tenant.count({ where }),
        this.prisma.lease.count({
          where: isSuperAdmin ? {} : { property: { companyId: actor.companyId } },
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

    const where = isSuperAdmin ? {} : { property: { companyId: actor.companyId } };

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
}
