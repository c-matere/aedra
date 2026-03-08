import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditLogService } from './audit/audit-log.service';
import { UsersService } from './users/users.service';
import type { RequestWithUser } from './auth/request-with-user.interface';
import { UserRole } from './auth/roles.enum';

describe('AppController', () => {
  let appController: AppController;
  const auditLogService = {
    read: jest.fn().mockResolvedValue([]),
  };
  const usersService = {
    findOne: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue(null),
  };

  const superAdminReq = {
    user: {
      id: 'sa-1',
      role: UserRole.SUPER_ADMIN,
      companyId: undefined,
    },
  } as Partial<RequestWithUser> as RequestWithUser;

  const companyAdminReq = {
    user: {
      id: 'ca-1',
      role: UserRole.COMPANY_ADMIN,
      companyId: 'company-a',
    },
  } as Partial<RequestWithUser> as RequestWithUser;

  beforeEach(async () => {
    jest.clearAllMocks();

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: AuditLogService,
          useValue: auditLogService,
        },
        {
          provide: UsersService,
          useValue: usersService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('audit logs', () => {
    it('should pass parsed filters to AuditLogService (super admin sees all)', async () => {
      await appController.getAuditLogs(
        superAdminReq,
        '25',
        'READ',
        'SUCCESS',
        'users',
        'actor-1',
      );

      expect(auditLogService.read).toHaveBeenCalledWith({
        limit: 25,
        action: 'READ',
        outcome: 'SUCCESS',
        entity: 'users',
        actorId: 'actor-1',
        actorCompanyId: undefined,
      });
    });

    it('should scope company admin to their own company', async () => {
      await appController.getAuditLogs(
        companyAdminReq,
        '10',
        'READ',
        'SUCCESS',
        'users',
        undefined,
      );

      expect(auditLogService.read).toHaveBeenCalledWith({
        limit: 10,
        action: 'READ',
        outcome: 'SUCCESS',
        entity: 'users',
        actorId: undefined,
        actorCompanyId: 'company-a',
      });
    });

    it('should ignore invalid action/outcome values', async () => {
      await appController.getAuditLogs(
        superAdminReq,
        '10',
        'BAD',
        'WRONG',
        'users',
      );

      expect(auditLogService.read).toHaveBeenCalledWith({
        limit: 10,
        action: undefined,
        outcome: undefined,
        entity: 'users',
        actorId: undefined,
        actorCompanyId: undefined,
      });
    });
  });
});
