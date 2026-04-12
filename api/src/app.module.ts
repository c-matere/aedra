import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { RolesGuard } from './auth/roles.guard';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TenantsModule } from './tenants/tenants.module';
import { PropertiesModule } from './properties/properties.module';
import { LandlordsModule } from './landlords/landlords.module';
import { UnitsModule } from './units/units.module';
import { ExpensesModule } from './expenses/expenses.module';
import { LeasesModule } from './leases/leases.module';
import { PaymentsModule } from './payments/payments.module';
import { MaintenanceRequestsModule } from './maintenance-requests/maintenance-requests.module';
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
import { RolesModule } from './roles/roles.module';
import { StaffModule } from './staff/staff.module';
import { ZuriLeaseModule } from './integrations/zuri-lease/zuri-lease.module';
import { ScheduleModule } from '@nestjs/schedule';

import { TenantContextInterceptor } from './common/interceptors/tenant-context.interceptor';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    ScheduleModule.forRoot(),
    MessagingModule,
    PaymentsModule,
    AiModule,
    AuthModule,
    UsersModule,
    TenantsModule,
    PropertiesModule,
    LandlordsModule,
    ExpensesModule,
    LeasesModule,
    MaintenanceRequestsModule,
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
    TodoModule,
    WorkflowModule,
    RolesModule,
    StaffModule,
    ZuriLeaseModule,
  ],

  controllers: [
    AppController,
  ],
  providers: [
    AppService,
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
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
