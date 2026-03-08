import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentMethod, PaymentType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';

export interface CreatePaymentDto {
  amount: number;
  leaseId: string;
  paidAt?: string | Date;
  method?: string;
  type?: string;
  reference?: string;
  notes?: string;
}

export interface UpdatePaymentDto {
  amount?: number;
  leaseId?: string;
  paidAt?: string | Date;
  method?: string;
  type?: string;
  reference?: string;
  notes?: string;
}

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) { }

  async findAll(actor: AuthenticatedUser, page = 1, limit = 10, search?: string) {
    const skip = (page - 1) * limit;
    const take = limit;

    const where: Prisma.PaymentWhereInput = {
      ...(actor.role !== 'SUPER_ADMIN' ? { lease: { tenant: { companyId: actor.companyId } } } : {}),
      ...(search ? {
        OR: [
          { reference: { contains: search, mode: 'insensitive' } },
          { lease: { tenant: { firstName: { contains: search, mode: 'insensitive' } } } },
          { lease: { tenant: { lastName: { contains: search, mode: 'insensitive' } } } },
          { lease: { property: { name: { contains: search, mode: 'insensitive' } } } },
          { lease: { unit: { unitNumber: { contains: search, mode: 'insensitive' } } } },
        ]
      } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          lease: {
            select: {
              id: true,
              tenant: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  companyId: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.payment.count({ where }),
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
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        lease: {
          select: {
            id: true,
            tenant: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                companyId: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found.');
    }

    if (
      actor.role !== 'SUPER_ADMIN' &&
      payment.lease.tenant.companyId !== actor.companyId
    ) {
      throw new ForbiddenException('You cannot access this payment.');
    }

    return payment;
  }

  async create(data: CreatePaymentDto, actor: AuthenticatedUser) {
    const lease = await this.requireLeaseAccess(data.leaseId, actor);

    const createData: Prisma.PaymentUncheckedCreateInput = {
      leaseId: lease.id,
      amount: data.amount,
      paidAt: data.paidAt ? new Date(data.paidAt) : undefined,
      method: data.method ? this.parseMethod(data.method) : PaymentMethod.MPESA,
      type: data.type ? this.parseType(data.type) : PaymentType.RENT,
      reference: data.reference,
      notes: data.notes,
    };

    return this.prisma.payment.create({
      data: createData,
      include: {
        lease: {
          select: {
            id: true,
            tenant: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                companyId: true,
              },
            },
          },
        },
      },
    });
  }

  async update(id: string, data: UpdatePaymentDto, actor: AuthenticatedUser) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        lease: {
          select: { id: true, tenant: { select: { companyId: true } } },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found.');
    }

    if (
      actor.role !== 'SUPER_ADMIN' &&
      payment.lease.tenant.companyId !== actor.companyId
    ) {
      throw new ForbiddenException('You cannot update this payment.');
    }

    const leaseId = data.leaseId ?? payment.lease.id;
    await this.requireLeaseAccess(leaseId, actor);

    const updateData: Prisma.PaymentUncheckedUpdateInput = {
      ...(data.amount !== undefined ? { amount: data.amount } : {}),
      ...(data.leaseId !== undefined ? { leaseId: data.leaseId } : {}),
      ...(data.paidAt !== undefined ? { paidAt: new Date(data.paidAt) } : {}),
      ...(data.method !== undefined
        ? { method: this.parseMethod(data.method) }
        : {}),
      ...(data.type !== undefined ? { type: this.parseType(data.type) } : {}),
      ...(data.reference !== undefined ? { reference: data.reference } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
    };

    return this.prisma.payment.update({
      where: { id },
      data: updateData,
      include: {
        lease: {
          select: {
            id: true,
            tenant: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                companyId: true,
              },
            },
          },
        },
      },
    });
  }

  async remove(id: string, actor: AuthenticatedUser) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        lease: { select: { tenant: { select: { companyId: true } } } },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found.');
    }

    if (
      actor.role !== 'SUPER_ADMIN' &&
      payment.lease.tenant.companyId !== actor.companyId
    ) {
      throw new ForbiddenException('You cannot delete this payment.');
    }

    return this.prisma.payment.delete({ where: { id } });
  }

  private async requireLeaseAccess(leaseId: string, actor: AuthenticatedUser) {
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      include: { tenant: { select: { companyId: true } } },
    });

    if (!lease) {
      throw new NotFoundException('Lease not found.');
    }

    if (
      actor.role !== 'SUPER_ADMIN' &&
      lease.tenant.companyId !== actor.companyId
    ) {
      throw new ForbiddenException('You cannot access that lease.');
    }

    return lease;
  }

  private parseMethod(raw: string): PaymentMethod {
    if ((Object.values(PaymentMethod) as string[]).includes(raw)) {
      return raw as PaymentMethod;
    }

    throw new BadRequestException(`Invalid payment method: ${raw}`);
  }

  private parseType(raw: string): PaymentType {
    if ((Object.values(PaymentType) as string[]).includes(raw)) {
      return raw as PaymentType;
    }

    throw new BadRequestException(`Invalid payment type: ${raw}`);
  }
}
