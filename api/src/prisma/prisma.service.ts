import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { tenantContext } from '../common/tenant-context';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);
  private _extended: any;
  private readonly txOptions: { maxWait: number; timeout: number };

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL is not set. Ensure api/.env is loaded before PrismaService initialization.',
      );
    }

    const pool = new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX ?? 20),
      idleTimeoutMillis: Number(process.env.DATABASE_POOL_IDLE_MS ?? 10_000),
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });

    this.txOptions = {
      maxWait: Number(process.env.PRISMA_TX_MAX_WAIT_MS ?? 10_000),
      timeout: Number(process.env.PRISMA_TX_TIMEOUT_MS ?? 20_000),
    };

    // Initialize the extended client
    this._extended = this.initExtendedClient();

    // The Proxy ensures all property access and method calls are delegated to the extended client
    // while maintaining compatibility with the injected NestJS singleton.
    return new Proxy(this, {
      get: (target, prop, receiver) => {
        if (prop === 'onModuleInit') return target.onModuleInit.bind(target);
        if (prop === '$connect') return target.$connect.bind(target);
        return (
          Reflect.get(target._extended, prop, receiver) ||
          Reflect.get(target, prop, receiver)
        );
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  // Model names that support soft-delete
  private readonly softDeleteModels = [
    'User',
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
    'WorkflowInstance',
    'Income',
  ];

  private initExtendedClient() {
    const base = this; // Base PrismaClient
    return base
      .$extends({
        query: {
          $allModels: {
            async findMany({ model, args, query }) {
              if (base.softDeleteModels.includes(model)) {
                (args as any).where = {
                  ...(args as any).where,
                  deletedAt: null,
                };
              }
              return query(args);
            },
            async findFirst({ model, args, query }) {
              if (base.softDeleteModels.includes(model)) {
                (args as any).where = {
                  ...(args as any).where,
                  deletedAt: null,
                };
              }
              return query(args);
            },
            async delete({ model, args, query }) {
              if (base.softDeleteModels.includes(model)) {
                return this.update({
                  where: (args as any).where,
                  data: { deletedAt: new Date() },
                });
              }
              return query(args);
            },
            async deleteMany({ model, args, query }) {
              if (base.softDeleteModels.includes(model)) {
                return this.updateMany({
                  where: (args as any).where,
                  data: { deletedAt: new Date() },
                });
              }
              return query(args);
            },
          },
        },
      })
      .$extends({
        query: {
          $allModels: {
            async $allOperations({ model, operation, args, query }) {
              const context = tenantContext.getStore();
              // Bypass RLS if no context is found (seeds, startup, etc) or for certain system operations
              if (!context || model === 'AuditLog') {
                return query(args);
              }

              // Using transaction to set session variables then execute the operation.
              // We use the base service to avoid recursion.
              return base.$transaction(async (tx) => {
                await tx.$executeRaw`SELECT set_config('app.current_company_id', ${context.companyId || ''}, TRUE)`;
                await tx.$executeRaw`SELECT set_config('app.is_super_admin', ${context.isSuperAdmin ? 'true' : 'false'}, TRUE)`;
                await tx.$executeRaw`SELECT set_config('app.current_user_id', ${context.userId || ''}, TRUE)`;

                // Now we need a way to run the query via THIS transaction context.
                // Note: query(args) from an extension might not automatically use the 'tx' here.
                // We transform model name (e.g. 'AuditLog') to camelCase ('auditLog') to match Prisma properties.
                const modelProp =
                  model.charAt(0).toLowerCase() + model.slice(1);
                return (tx as any)[modelProp][operation](args);
              }, this.txOptions);
            },
          },
        },
      });
  }
}
