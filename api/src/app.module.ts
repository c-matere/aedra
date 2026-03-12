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
import { UnitsController } from './units/units.controller';
import { UnitsService } from './units/units.service';
import { ExpensesController } from './expenses/expenses.controller';
import { ExpensesService } from './expenses/expenses.service';
import { LeasesController } from './leases/leases.controller';
import { LeasesService } from './leases/leases.service';
import { PaymentsController } from './payments/payments.controller';
import { PaymentsService } from './payments/payments.service';
import { MaintenanceRequestsController } from './maintenance-requests/maintenance-requests.controller';
import { MaintenanceRequestsService } from './maintenance-requests/maintenance-requests.service';
import { AuditLogService } from './audit/audit-log.service';
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

@Module({
  imports: [
    PrismaModule,
    AiModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: await redisStore({
          socket: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '4379'),
          },
        }),
      }),
    }),
    InvoicesModule,
    DocumentsModule,
    CompaniesModule,
    ReportsModule,
    FinancesModule,
  ],
  controllers: [
    AppController,
    AuthController,
    UsersController,
    TenantsController,
    PropertiesController,
    LandlordsController,
    UnitsController,
    ExpensesController,
    LeasesController,
    PaymentsController,
    MaintenanceRequestsController,
  ],
  providers: [
    AppService,
    AuthService,
    UsersService,
    TenantsService,
    PropertiesService,
    LandlordsService,
    UnitsService,
    ExpensesService,
    LeasesService,
    PaymentsService,
    MaintenanceRequestsService,
    AuditLogService,
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
