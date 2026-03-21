import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TodoStatus } from '@prisma/client';

@Injectable()
export class TodoService {
  private readonly logger = new Logger(TodoService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listTodos(userId: string) {
    return this.prisma.todoItem.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ isCritical: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createTodo(data: {
    title: string;
    description?: string;
    userId: string;
    isCritical?: boolean;
    dueDate?: Date;
  }) {
    return this.prisma.todoItem.create({
      data,
    });
  }

  async markAsDone(id: string, userId: string) {
    const todo = await this.prisma.todoItem.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!todo) throw new Error('Todo item not found or access denied.');

    return this.prisma.todoItem.update({
      where: { id },
      data: { status: TodoStatus.DONE },
    });
  }

  async deleteTodo(id: string, userId: string) {
    const todo = await this.prisma.todoItem.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!todo) throw new Error('Todo item not found or access denied.');

    return this.prisma.todoItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async generateDailyCriticalTasks(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });
    if (!user || !user.companyId) return [];

    const companyId = user.companyId;
    const now = new Date();
    const thirtyDaysAhead = new Date();
    thirtyDaysAhead.setDate(now.getDate() + 30);

    const [urgentMaintenance, overdueInvoices, expiringLeases] =
      await Promise.all([
        this.prisma.maintenanceRequest.findMany({
          where: {
            companyId,
            priority: 'URGENT',
            status: { not: 'COMPLETED' },
            deletedAt: null,
          },
          take: 10,
        }),
        this.prisma.invoice.findMany({
          where: {
            lease: { property: { companyId } },
            dueDate: { lt: now },
            status: 'PENDING',
            deletedAt: null,
          },
          take: 10,
        }),
        this.prisma.lease.findMany({
          where: {
            property: { companyId },
            endDate: { lte: thirtyDaysAhead, gte: now },
            status: 'ACTIVE',
            deletedAt: null,
          },
          take: 10,
        }),
      ]);

    const itemsToCreate: any[] = [];

    urgentMaintenance.forEach((req) => {
      itemsToCreate.push({
        title: `URGENT: Maintenance - ${req.title}`,
        description: `Urgent maintenance request ${req.id} requires attention.`,
        isCritical: true,
        userId,
      });
    });

    overdueInvoices.forEach((inv) => {
      itemsToCreate.push({
        title: `OVERDUE: Invoice - ${inv.id}`,
        description: `Invoice for ${inv.amount} is overdue (Due: ${inv.dueDate.toDateString()}).`,
        isCritical: true,
        userId,
      });
    });

    expiringLeases.forEach((lease) => {
      itemsToCreate.push({
        title: `EXPIRING: Lease - ${lease.id}`,
        description: `Lease for unit ${lease.unitId} is expiring on ${lease.endDate.toDateString()}.`,
        isCritical: true,
        userId,
      });
    });

    // Avoid duplicates for the same day (naive check: title + date)
    const existingToday = await this.prisma.todoItem.findMany({
      where: { userId, createdAt: { gte: new Date(now.setHours(0, 0, 0, 0)) } },
      select: { title: true },
    });
    const existingTitles = new Set(
      existingToday.map((t: { title: string }) => t.title),
    );

    const finalItems = itemsToCreate.filter(
      (item) => !existingTitles.has(item.title),
    );

    if (finalItems.length > 0) {
      await this.prisma.todoItem.createMany({
        data: finalItems,
      });
    }

    return finalItems;
  }
}
