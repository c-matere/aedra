import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeaseStatus, Prisma, InvoiceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { TenantsService, CreateTenantDto } from '../tenants/tenants.service';

export interface CreateLeaseDto {
  startDate: string;
  endDate?: string;
  rentAmount: number;
  deposit?: number;
  status?: string;
  propertyId: string;
  unitId?: string;
  tenantId?: string;
  newTenant?: Omit<CreateTenantDto, 'propertyId'>;
  notes?: string;
  reminders?: { text: string; remindAt: string }[];
  agreementFee?: number;
}

export interface UpdateLeaseDto {
  startDate?: string;
  endDate?: string;
  rentAmount?: number;
  deposit?: number;
  status?: string;
  propertyId?: string;
  unitId?: string;
  tenantId?: string;
}

@Injectable()
export class LeasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantsService: TenantsService,
  ) {}

  async findAll(
    actor: AuthenticatedUser,
    page = 1,
    limit = 10,
    search?: string,
    tenantId?: string,
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

    const where: Prisma.LeaseWhereInput = {
      tenant: isSuperAdmin ? {} : { companyId: actor.companyId },
      ...(tenantId ? { tenantId } : {}),
      ...(search
        ? {
            OR: [
              {
                tenant: {
                  firstName: { contains: search, mode: 'insensitive' },
                },
              },
              {
                tenant: { lastName: { contains: search, mode: 'insensitive' } },
              },
              {
                unit: { unitNumber: { contains: search, mode: 'insensitive' } },
              },
              { property: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [leases, total] = await Promise.all([
      this.prisma.lease.findMany({
        where,
        include: {
          tenant: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              companyId: true,
            },
          },
          unit: { select: { id: true, unitNumber: true } },
          _count: {
            select: { invoices: true, payments: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.lease.count({ where }),
    ]);

    // Optimized: Batch fetch aggregates for all leases in the page
    const leaseIds = leases.map((l) => l.id);
    const invoiceSums = await this.prisma.invoice.groupBy({
      by: ['leaseId'],
      _sum: { amount: true },
      where: { leaseId: { in: leaseIds } },
    });
    const paymentSums = await this.prisma.payment.groupBy({
      by: ['leaseId'],
      _sum: { amount: true },
      where: { leaseId: { in: leaseIds } },
    });

    const invoiceMap = new Map(invoiceSums.map(s => [s.leaseId, s._sum.amount || 0]));
    const paymentMap = new Map(paymentSums.map(s => [s.leaseId, s._sum.amount || 0]));

    const dataWithBalances = leases.map((lease) => {
      const billed = invoiceMap.get(lease.id) || 0;
      const paid = paymentMap.get(lease.id) || 0;
      return {
        ...lease,
        balance: billed - paid,
      };
    });

    return {
      data: dataWithBalances,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const lease = await this.prisma.lease.findUnique({
      where: { id },
      include: {
        tenant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyId: true,
          },
        },
        unit: { select: { id: true, unitNumber: true } },
      },
    });

    if (!lease) {
      throw new NotFoundException('Lease not found.');
    }

    if (
      actor.role !== 'SUPER_ADMIN' &&
      lease.tenant.companyId !== actor.companyId
    ) {
      throw new ForbiddenException('You cannot access this lease.');
    }

    const [sumInvoices, sumPayments] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { leaseId: lease.id },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { leaseId: lease.id },
        _sum: { amount: true },
      }),
    ]);

    const billed = sumInvoices._sum.amount || 0;
    const paid = sumPayments._sum.amount || 0;

    return {
      ...lease,
      balance: billed - paid,
    };
  }

  async create(data: CreateLeaseDto, actor: AuthenticatedUser) {
    let tenantId = data.tenantId;

    if (!tenantId && data.newTenant) {
      const newTenant = await this.tenantsService.create(
        {
          ...data.newTenant,
          propertyId: data.propertyId,
        },
        actor,
      );
      tenantId = newTenant.id;
    }

    if (!tenantId) {
      throw new BadRequestException('Tenant ID or new tenant data is required.');
    }

    const relation = await this.validateTenantPropertyUnit(
      tenantId,
      data.propertyId,
      data.unitId,
      actor,
    );

    const startDate = new Date(data.startDate);
    let endDate = data.endDate ? new Date(data.endDate) : undefined;

    if (!endDate) {
      endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + 2);
    }

    const createData: Prisma.LeaseUncheckedCreateInput = {
      startDate,
      endDate,
      rentAmount: data.rentAmount,
      deposit: data.deposit,
      status: data.status ? this.parseStatus(data.status) : LeaseStatus.PENDING,
      propertyId: relation.property.id,
      unitId: data.unitId ? data.unitId : null,
      tenantId: relation.tenant.id,
      notes: data.notes,
      agreementFee: data.agreementFee,
    };

    const lease = await this.prisma.lease.create({
      data: createData,
      include: {
        tenant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyId: true,
          },
        },
        unit: { select: { id: true, unitNumber: true } },
      },
    });

    if (data.reminders && data.reminders.length > 0) {
      await this.prisma.leaseReminder.createMany({
        data: data.reminders.map((r) => ({
          text: r.text,
          remindAt: new Date(r.remindAt),
          leaseId: lease.id,
        })),
      });
    }
    
    if (data.agreementFee && data.agreementFee > 0) {
      await this.prisma.invoice.create({
        data: {
          amount: data.agreementFee,
          description: 'Agreement Fee',
          type: InvoiceType.AGREEMENT_FEE,
          dueDate: new Date(),
          status: 'PENDING',
          leaseId: lease.id,
          companyId: actor.companyId,
        },
      });
    }

    return lease;
  }

  async update(id: string, data: UpdateLeaseDto, actor: AuthenticatedUser) {
    const existing = await this.prisma.lease.findUnique({
      where: { id },
      include: {
        tenant: { select: { id: true, companyId: true } },
        unit: {
          select: { id: true, property: { select: { companyId: true } } },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Lease not found.');
    }

    if (
      actor.role !== 'SUPER_ADMIN' &&
      existing.tenant.companyId !== actor.companyId
    ) {
      throw new ForbiddenException('You cannot update this lease.');
    }

    const tenantId = data.tenantId ?? existing.tenant.id;
    const propertyId = data.propertyId ?? existing.propertyId;
    const unitId = data.unitId ?? existing.unitId ?? undefined;

    await this.validateTenantPropertyUnit(tenantId, propertyId, unitId, actor);

    const updateData: Prisma.LeaseUncheckedUpdateInput = {
      ...(data.startDate !== undefined
        ? { startDate: new Date(data.startDate) }
        : {}),
      ...(data.endDate !== undefined
        ? { endDate: new Date(data.endDate) }
        : {}),
      ...(data.rentAmount !== undefined ? { rentAmount: data.rentAmount } : {}),
      ...(data.deposit !== undefined ? { deposit: data.deposit } : {}),
      ...(data.status !== undefined
        ? { status: this.parseStatus(data.status) }
        : {}),
      ...(data.propertyId !== undefined ? { propertyId: data.propertyId } : {}),
      ...(data.unitId !== undefined ? { unitId: data.unitId } : {}),
      ...(data.unitId === null ? { unitId: null } : {}),
      ...(data.tenantId !== undefined ? { tenantId: data.tenantId } : {}),
    };

    return this.prisma.lease.update({
      where: { id },
      data: updateData,
      include: {
        tenant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyId: true,
          },
        },
        unit: { select: { id: true, unitNumber: true } },
      },
    });
  }

  async remove(id: string, actor: AuthenticatedUser) {
    const existing = await this.prisma.lease.findUnique({
      where: { id },
      include: { tenant: { select: { companyId: true } } },
    });

    if (!existing) {
      throw new NotFoundException('Lease not found.');
    }

    if (
      actor.role !== 'SUPER_ADMIN' &&
      existing.tenant.companyId !== actor.companyId
    ) {
      throw new ForbiddenException('You cannot delete this lease.');
    }

    return this.prisma.lease.delete({ where: { id } });
  }

  private parseStatus(raw: string): LeaseStatus {
    if ((Object.values(LeaseStatus) as string[]).includes(raw)) {
      return raw as LeaseStatus;
    }

    throw new BadRequestException(`Invalid lease status: ${raw}`);
  }

  private async validateTenantPropertyUnit(
    tenantId: string,
    propertyId: string,
    unitId: string | undefined,
    actor: AuthenticatedUser,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, companyId: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }

    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, companyId: true },
    });
    if (!property) {
      throw new NotFoundException('Property not found.');
    }

    if (tenant.companyId !== property.companyId) {
      throw new BadRequestException(
        'Tenant and property must belong to the same company.',
      );
    }

    if (unitId) {
      const unit = await this.prisma.unit.findUnique({
        where: { id: unitId },
        select: { id: true, propertyId: true },
      });
      if (!unit || unit.propertyId !== property.id) {
        throw new BadRequestException(
          'Unit must belong to the specified property.',
        );
      }
    }

    if (actor.role !== 'SUPER_ADMIN' && tenant.companyId !== actor.companyId) {
      throw new ForbiddenException(
        'You cannot manage leases for this company.',
      );
    }

    return { tenant, property };
  }
}
