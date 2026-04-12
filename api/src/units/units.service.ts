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

  async getPortfolioSnapshot(actor: AuthenticatedUser, propertyId?: string) {
    const companyId = actor.companyId;
    const isSuperAdmin = actor.role === 'SUPER_ADMIN';

    // Critical: If not super admin, must have companyId.
    // If super admin, should have companyId or propertyId to avoid scanning the entire database.
    if (!companyId && !propertyId && !isSuperAdmin) {
      return {};
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const where: Prisma.PropertyWhereInput = {
      ...(companyId ? { companyId } : {}),
      ...(propertyId ? { id: propertyId } : {}),
      deletedAt: null,
    };

    // Safety check for SUPER_ADMIN without specific scope
    if (Object.keys(where).filter((k) => k !== 'deletedAt').length === 0) {
      this.prisma.$connect(); // Ensure connection is warm
      // If no scope, we limit to 5 properties max to prevent 30s timeouts
      (where as any).id = { not: undefined };
    }

    const properties = await this.prisma.property.findMany({
      where,
      include: {
        units: {
          where: { deletedAt: null },
          include: {
            leases: {
              where: { status: 'ACTIVE', deletedAt: null },
              include: {
                tenant: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    phone: true,
                  },
                },
                payments: {
                  where: { paidAt: { gte: startOfMonth }, deletedAt: null },
                },
                invoices: {
                  where: { deletedAt: null, status: { not: 'VOID' as any } },
                },
                penalties: {
                  where: { deletedAt: null, status: { not: 'WAIVED' } },
                },
              },
            },
          },
        },
      },
    });

    const snapshot: Record<string, any> = {};

    for (const prop of properties) {
      let totalExpected = 0;
      let totalCollected = 0;
      const all_units: any[] = [];
      const paid_this_month: any[] = [];
      const unpaid_this_month: any[] = [];
      const partial_payments: any[] = [];

      for (const unit of (prop as any).units) {
        const activeLease = unit.leases[0];
        if (!activeLease) continue;

        // Arrears Logic:
        // Expected = Current Month Rent + All Pending/Historical Unpaid Invoices + All Pending Penalties
        // Collected = Payments made this month (or total payments against those items?)
        
        // Let's stick to the service's "Collection Rate" definition: 
        // How much of the TOTAL DEBT (Rent + Penalties + Invoices) has been covered by TOTAL PAYMENTS.
        
        const rentAmount = activeLease.rentAmount;
        const penaltiesAmount = activeLease.penalties.reduce((sum: number, p: any) => sum + p.amount, 0);
        const invoicesAmount = activeLease.invoices.reduce((sum: number, i: any) => sum + i.amount, 0);
        
        const expected = rentAmount + penaltiesAmount + invoicesAmount;
        const collected = activeLease.payments.reduce((sum: number, p: any) => sum + p.amount, 0);

        totalExpected += expected;
        totalCollected += collected;

        const unitInfo = {
          id: unit.id,
          number: unit.unitNumber,
          tenant: `${activeLease.tenant.firstName} ${activeLease.tenant.lastName}`,
          expected,
          collected,
          balance: expected - collected
        };

        all_units.push(unitInfo);

        if (collected >= expected) {
          paid_this_month.push(unitInfo);
        } else if (collected > 0) {
          partial_payments.push(unitInfo);
          unpaid_this_month.push(unitInfo);
        } else {
          unpaid_this_month.push(unitInfo);
        }
      }

      snapshot[prop.id] = {
        name: prop.name,
        all_units,
        paid_this_month,
        unpaid_this_month,
        partial_payments,
        total_expected: totalExpected,
        total_collected: totalCollected,
        balance: totalExpected - totalCollected,
        collection_rate:
          totalExpected > 0
            ? Math.round((totalCollected / totalExpected) * 100)
            : 0,
      };
    }

    // Sort properties by balance descending (highest arrears first)
    const sortedEntries = Object.entries(snapshot).sort(
      (a, b) => b[1].balance - a[1].balance,
    );

    const portfolioTotals = sortedEntries.reduce(
      (acc, [_, data]) => {
        acc.expected += data.total_expected;
        acc.collected += data.total_collected;
        return acc;
      },
      { expected: 0, collected: 0 },
    );

    return {
      properties: Object.fromEntries(sortedEntries),
      totals: {
        ...portfolioTotals,
        balance: portfolioTotals.expected - portfolioTotals.collected,
        rate:
          portfolioTotals.expected > 0
            ? Math.round(
                (portfolioTotals.collected / portfolioTotals.expected) * 100,
              )
            : 0,
      },
    };
  }
}
