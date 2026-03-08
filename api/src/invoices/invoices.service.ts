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
      status: data.status || 'PENDING',
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
      ...(data.status !== undefined ? { status: data.status } : {}),
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
}
