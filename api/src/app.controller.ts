import { Body, Controller, Get, Patch, Query, Req } from '@nestjs/common';
import { AppService } from './app.service';
import { Roles } from './auth/roles.decorator';
import { UserRole } from './auth/roles.enum';
import type { RequestWithUser } from './auth/request-with-user.interface';
import { AuditLogService } from './audit/audit-log.service';
import { UsersService } from './users/users.service';
import type {
  AuditAction,
  AuditLogFilter,
  AuditOutcome,
} from './audit/audit-log.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly auditLogService: AuditLogService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('me')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.COMPANY_STAFF)
  async getMe(@Req() req: RequestWithUser) {
    return {
      user: await this.usersService.findOne(req.user!, req.user!.id),
    };
  }

  @Patch('me')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.COMPANY_STAFF)
  async updateMe(@Req() req: RequestWithUser, @Body() data: any) {
    // Only allow updating specific fields for self-service profile
    const allowedData = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      password: data.password,
    };
    // Remove undefined fields
    Object.keys(allowedData).forEach(
      (key) =>
        allowedData[key as keyof typeof allowedData] === undefined &&
        delete allowedData[key as keyof typeof allowedData],
    );

    return this.usersService.update(req.user!, req.user!.id, allowedData);
  }

  @Get('admin/settings')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  getAdminSettings() {
    return {
      message: 'Admin-only settings payload',
      requiredRoles: [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN],
    };
  }

  @Get('admin/audit-logs')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  async getAuditLogs(
    @Req() req: RequestWithUser,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('outcome') outcome?: string,
    @Query('entity') entity?: string,
    @Query('actorId') actorId?: string,
    @Query('targetId') targetId?: string,
  ) {
    const isSuperAdmin = req.user?.role === UserRole.SUPER_ADMIN;

    const filter: AuditLogFilter = {
      limit: limit ? Number(limit) : undefined,
      action: this.toAuditAction(action),
      outcome: this.toAuditOutcome(outcome),
      entity,
      actorId,
      targetId,
      // If not super admin, restrict to their own company
      actorCompanyId: !isSuperAdmin ? req.user?.companyId : undefined,
    };

    return {
      logs: await this.auditLogService.read(filter),
      filters: filter,
    };
  }

  private toAuditAction(value?: string): AuditAction | undefined {
    if (!value) {
      return undefined;
    }

    const actions: AuditAction[] = [
      'CREATE',
      'READ',
      'UPDATE',
      'DELETE',
      'AUTH',
      'SYSTEM',
    ];
    return actions.includes(value as AuditAction)
      ? (value as AuditAction)
      : undefined;
  }

  private toAuditOutcome(value?: string): AuditOutcome | undefined {
    if (!value) {
      return undefined;
    }

    const outcomes: AuditOutcome[] = ['SUCCESS', 'FAILURE'];
    return outcomes.includes(value as AuditOutcome)
      ? (value as AuditOutcome)
      : undefined;
  }
}
