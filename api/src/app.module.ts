import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { RolesGuard } from './auth/roles.guard';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';
import { TenantsController } from './tenants/tenants.controller';
import { TenantsService } from './tenants/tenants.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { PropertiesController } from './properties/properties.controller';
import { PropertiesService } from './properties/properties.service';
import { LandlordsController } from './landlords/landlords.controller';
import { LandlordsService } from './landlords/landlords.service';
import { UnitsModule } from './units/units.module';
import { ExpensesController } from './expenses/expenses.controller';
import { ExpensesService } from './expenses/expenses.service';
import { LeasesController } from './leases/leases.controller';
import { LeasesService } from './leases/leases.service';
import { PaymentsController } from './payments/payments.controller';
import { PaymentsService } from './payments/payments.service';
import { MpesaController } from './payments/mpesa.controller';
import { MpesaService } from './payments/mpesa.service';
import { MaintenanceRequestsController } from './maintenance-requests/maintenance-requests.controller';
import { MaintenanceRequestsService } from './maintenance-requests/maintenance-requests.service';
import { AuditModule } from './audit/audit.module';
import { AuditLoggingInterceptor } from './audit/audit-logging.interceptor';
import { InvoicesModule } from './invoices/invoices.module';
import { DocumentsModule } from './documents/documents.module';
import { CompaniesModule } from './companies/companies.module';
import { ReportsModule } from './reports/reports.module';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { TenantMiddleware } from './common/tenant-middleware';
import { AiModule } from './ai/ai.module';
import { FinancesModule } from './finances/finances.module';
import { MessagingModule } from './messaging/messaging.module';
import { BullModule } from '@nestjs/bullmq';
import { WorkflowModule } from './workflows/workflow.module';
import { TodoModule } from './todo/todo.module';

@Module({
  imports: [
    PrismaModule,
    AiModule,
    AuditModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => {
        const redisDisabled = process.env.REDIS_DISABLED === 'true';
        if (redisDisabled) {
          return { store: 'memory' as const };
        }
        try {
          return {
            store: await redisStore({
              socket: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '4379'),
              },
            }),
          };
        } catch (err: any) {
          // If Redis is unavailable (e.g., dev sandbox), fall back to in-memory cache
          console.warn(
            `Redis unavailable (${err?.code || err?.message || 'unknown'}); falling back to in-memory cache.`,
          );
          return { store: 'memory' as const };
        }
      },
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '4379'),
      },
    }),
    InvoicesModule,
    DocumentsModule,
    CompaniesModule,
    ReportsModule,
    UnitsModule,
    FinancesModule,
    MessagingModule,
    TodoModule,
    WorkflowModule,
  ],
  controllers: [
    AppController,
    AuthController,
    UsersController,
    TenantsController,
    PropertiesController,
    LandlordsController,
    ExpensesController,
    LeasesController,
    PaymentsController,
    MpesaController,
    MaintenanceRequestsController,
  ],
  providers: [
    AppService,
    AuthService,
    UsersService,
    TenantsService,
    PropertiesService,
    LandlordsService,
    ExpensesService,
    LeasesService,
    PaymentsService,
    MpesaService,
    MaintenanceRequestsService,
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLoggingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
