import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL is not set. Ensure api/.env is loaded before PrismaService initialization.',
      );
    }

    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  // Global soft-delete extension
  async $connect() {
    await super.$connect();
  }

  // Define a set of models that support soft delete
  private readonly softDeleteModels = [
    'User',
    'Company',
    'Landlord',
    'Property',
    'Unit',
    'Tenant',
    'Lease',
    'MaintenanceRequest',
    'Payment',
    'Invoice',
    'Document',
    'Expense',
    'Penalty',
  ];

  getSoftDeleteClient() {
    return this.$extends({
      query: {
        $allModels: {
          async findMany({ model, args, query }) {
            if (PrismaService.prototype.softDeleteModels.includes(model)) {
              (args as any).where = { ...(args as any).where, deletedAt: null };
            }
            return query(args);
          },
          async findFirst({ model, args, query }) {
            if (PrismaService.prototype.softDeleteModels.includes(model)) {
              (args as any).where = { ...(args as any).where, deletedAt: null };
            }
            return query(args);
          },
          async findUnique({ model, args, query }) {
            if (PrismaService.prototype.softDeleteModels.includes(model)) {
              // Convert findUnique to findFirst to allow filtering by deletedAt
              return this.findFirst({
                where: { ...(args as any).where, deletedAt: null },
                select: (args as any).select,
                include: (args as any).include,
              });
            }
            return query(args);
          },
          async delete({ model, args, query }) {
            if (PrismaService.prototype.softDeleteModels.includes(model)) {
              return this.update({
                where: (args as any).where,
                data: { deletedAt: new Date() },
              });
            }
            return query(args);
          },
          async deleteMany({ model, args, query }) {
            if (PrismaService.prototype.softDeleteModels.includes(model)) {
              return this.updateMany({
                where: (args as any).where,
                data: { deletedAt: new Date() },
              });
            }
            return query(args);
          },
        },
      },
    });
  }

  // Method to get a Prisma instance bounded to a specific tenant
  // leveraging Prisma Client Extensions for RLS
  getTenantClient(tenantId: string) {
    return this.getSoftDeleteClient().$extends({
      query: {
        $allModels: {
          async $allOperations({ args, query }) {
            // Apply RLS session variable before executing the query against DB
            const [, result] = await PrismaService.prototype.$transaction([
              PrismaService.prototype
                .$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, TRUE)`,
              query(args),
            ]);
            return result;
          },
        },
      },
    });
  }
}
