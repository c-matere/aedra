import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { CreateInvoiceDto, UpdateInvoiceDto } from './dto/invoice.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    actor: AuthenticatedUser,
    page = 1,
    limit = 10,
    search?: string,
  ) {
    const skip = (page - 1) * limit;
    const take = limit;

    const where: Prisma.InvoiceWhereInput = {
      ...(actor.role !== 'SUPER_ADMIN'
        ? { lease: { tenant: { companyId: actor.companyId } } }
        : {}),
      ...(search
        ? {
            OR: [
              { description: { contains: search, mode: 'insensitive' } },
              {
                lease: {
                  tenant: {
                    firstName: { contains: search, mode: 'insensitive' },
                  },
                },
              },
              {
                lease: {
                  tenant: {
                    lastName: { contains: search, mode: 'insensitive' },
                  },
                },
              },
              {
                lease: {
                  property: { name: { contains: search, mode: 'insensitive' } },
                },
              },
              {
                lease: {
                  unit: {
                    unitNumber: { contains: search, mode: 'insensitive' },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: {
          lease: {
            select: {
              id: true,
              tenant: {
                select: { firstName: true, lastName: true, companyId: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.invoice.count({ where }),
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
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        lease: {
          select: { id: true, tenant: { select: { companyId: true } } },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found.');
    }

    if (
      actor.role !== 'SUPER_ADMIN' &&
      invoice.lease.tenant.companyId !== actor.companyId
    ) {
      throw new ForbiddenException('You cannot access this invoice.');
    }

    return invoice;
  }

  async create(data: CreateInvoiceDto, actor: AuthenticatedUser) {
    await this.validateLeaseCompany(data.leaseId, actor);

    const createData: Prisma.InvoiceUncheckedCreateInput = {
      amount: data.amount,
      description: data.description,
      type: (data.type as any) || 'RENT',
      dueDate: new Date(data.dueDate),
      status: (data.status as any) || 'PENDING',
      leaseId: data.leaseId,
    };

    return this.prisma.invoice.create({
      data: createData,
      include: {
        lease: {
          select: {
            id: true,
            tenant: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  async update(id: string, data: UpdateInvoiceDto, actor: AuthenticatedUser) {
    const existing = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        lease: {
          select: { id: true, tenant: { select: { companyId: true } } },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Invoice not found.');
    }

    if (
      actor.role !== 'SUPER_ADMIN' &&
      existing.lease.tenant.companyId !== actor.companyId
    ) {
      throw new ForbiddenException('You cannot update this invoice.');
    }

    if (data.leaseId && data.leaseId !== existing.leaseId) {
      await this.validateLeaseCompany(data.leaseId, actor);
    }

    const updateData: Prisma.InvoiceUncheckedUpdateInput = {
      ...(data.amount !== undefined ? { amount: data.amount } : {}),
      ...(data.description !== undefined
        ? { description: data.description }
        : {}),
      ...(data.dueDate !== undefined
        ? { dueDate: new Date(data.dueDate) }
        : {}),
      ...(data.status !== undefined ? { status: data.status as any } : {}),
      ...(data.type !== undefined ? { type: data.type as any } : {}),
      ...(data.leaseId !== undefined ? { leaseId: data.leaseId } : {}),
    };

    return this.prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        lease: {
          select: {
            id: true,
            tenant: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  async remove(id: string, actor: AuthenticatedUser) {
    const existing = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        lease: { select: { tenant: { select: { companyId: true } } } },
      },
    });

    if (!existing) {
      throw new NotFoundException('Invoice not found.');
    }

    if (
      actor.role !== 'SUPER_ADMIN' &&
      existing.lease.tenant.companyId !== actor.companyId
    ) {
      throw new ForbiddenException('You cannot delete this invoice.');
    }

    return this.prisma.invoice.delete({ where: { id } });
  }

  private async validateLeaseCompany(
    leaseId: string,
    actor: AuthenticatedUser,
  ) {
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      select: { id: true, tenant: { select: { companyId: true } } },
    });

    if (!lease) {
      throw new NotFoundException('Lease not found.');
    }

    if (
      actor.role !== 'SUPER_ADMIN' &&
      lease.tenant.companyId !== actor.companyId
    ) {
      throw new ForbiddenException(
        'You cannot manage invoices for this lease.',
      );
    }

    return lease;
  }

  async generateMonthlyInvoices(actor: AuthenticatedUser, propertyId?: string) {
    const companyId = actor.companyId;
    if (!companyId && actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Company context required');
    }

    const leases = await this.prisma.lease.findMany({
      where: {
        status: 'ACTIVE',
        ...(propertyId ? { propertyId } : {}),
        ...(companyId ? { property: { companyId } } : {}),
      },
      include: {
        unit: true,
        tenant: true,
      },
    });

    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    let createdCount = 0;

    for (const lease of leases) {
      // Check if invoice already exists for this lease this month
      const existing = await this.prisma.invoice.findFirst({
        where: {
          leaseId: lease.id,
          type: 'RENT',
          dueDate: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      });

      if (!existing) {
        await this.prisma.invoice.create({
          data: {
            amount: lease.rentAmount || 0,
            description: `Rent for ${now.toLocaleString('default', { month: 'long' })} ${year}`,
            dueDate: new Date(year, month, 5), // Default to 5th of month
            type: 'RENT',
            status: 'PENDING',
            leaseId: lease.id,
          },
        });
        createdCount++;
      }
    }

    return { createdCount, totalLeases: leases.length };
  }

  async autoReconcileIncome(actor: AuthenticatedUser, propertyId: string) {
    const companyId = actor.companyId;
    if (!companyId && actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Company context required');
    }

    // 1. Get all pending invoices for this property
    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: { in: ['PENDING', 'PARTIALLY_PAID'] },
        lease: { propertyId },
      },
      include: {
        lease: { include: { tenant: true } },
      },
    });

    // 2. Get all income records for this property
    const incomes = await this.prisma.income.findMany({
      where: { propertyId },
      orderBy: { date: 'desc' },
    });

    let reconciledCount = 0;

    for (const invoice of invoices) {
      // Find an income record that matches the amount and tenant name (if possible)
      const matchingIncome = incomes.find((inc) => {
        const amountMatch = Math.abs(inc.amount - invoice.amount) < 0.01;
        const nameMatch = invoice.lease.tenant.lastName && inc.description?.toLowerCase().includes(invoice.lease.tenant.lastName.toLowerCase());
        return amountMatch && nameMatch;
      });

      if (matchingIncome) {
        // Create a payment
        await this.prisma.$transaction(async (tx) => {
          await tx.payment.create({
            data: {
              amount: matchingIncome.amount,
              paidAt: matchingIncome.date,
              method: 'MPESA', // Assumption for Zuri
              reference: matchingIncome.description,
              leaseId: invoice.leaseId, // Payment links to lease
            },
          });

          await tx.invoice.update({
            where: { id: invoice.id },
            data: { status: 'PAID' },
          });
        });
        reconciledCount++;
      }
    }

    return { reconciledCount, totalInvoices: invoices.length };
  }
}
