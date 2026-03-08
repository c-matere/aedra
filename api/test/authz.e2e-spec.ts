import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { RolesGuard } from '../src/auth/roles.guard';
import { createSessionToken } from '../src/auth/session-token';
import { UserRole } from '../src/auth/roles.enum';
import { PropertiesController } from '../src/properties/properties.controller';
import { PropertiesService } from '../src/properties/properties.service';
import { TenantsController } from '../src/tenants/tenants.controller';
import { TenantsService } from '../src/tenants/tenants.service';
import { UsersController } from '../src/users/users.controller';
import { UsersService } from '../src/users/users.service';

describe('Authorization (e2e)', () => {
  let app: INestApplication<App>;

  const usersService = {
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: 'u1' }),
    create: jest.fn().mockResolvedValue({ id: 'u1' }),
    update: jest.fn().mockResolvedValue({ id: 'u1' }),
    remove: jest.fn().mockResolvedValue({ id: 'u1' }),
  };

  const tenantsService = {
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: 't1' }),
    create: jest.fn().mockResolvedValue({ id: 't1' }),
    update: jest.fn().mockResolvedValue({ id: 't1' }),
    remove: jest.fn().mockResolvedValue({ id: 't1' }),
  };

  const propertiesService = {
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: 'p1' }),
    create: jest.fn().mockResolvedValue({ id: 'p1' }),
    update: jest.fn().mockResolvedValue({ id: 'p1' }),
    remove: jest.fn().mockResolvedValue({ id: 'p1' }),
  };

  function bearer(role: UserRole, companyId = 'company-a') {
    const token = createSessionToken({
      userId: `user-${role}`,
      role,
      companyId,
    });
    return `Bearer ${token}`;
  }

  beforeAll(async () => {
    process.env.AUTH_SESSION_SECRET =
      '12345678901234567890123456789012-test-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [
        AppController,
        UsersController,
        TenantsController,
        PropertiesController,
      ],
      providers: [
        { provide: AppService, useValue: { getHello: () => 'Hello World!' } },
        { provide: UsersService, useValue: usersService },
        { provide: TenantsService, useValue: tenantsService },
        { provide: PropertiesService, useValue: propertiesService },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects protected route without token', async () => {
    await request(app.getHttpServer()).get('/users').expect(401);
  });

  it('forbids COMPANY_STAFF from /users', async () => {
    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', bearer(UserRole.COMPANY_STAFF))
      .expect(403);
  });

  it('allows COMPANY_ADMIN to /users', async () => {
    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', bearer(UserRole.COMPANY_ADMIN))
      .expect(200);

    expect(usersService.findAll).toHaveBeenCalledTimes(1);
  });

  it('forbids COMPANY_STAFF from mutating properties', async () => {
    await request(app.getHttpServer())
      .post('/properties')
      .set('Authorization', bearer(UserRole.COMPANY_STAFF))
      .send({ name: 'Blocked' })
      .expect(403);
  });

  it('allows COMPANY_STAFF to read properties', async () => {
    await request(app.getHttpServer())
      .get('/properties')
      .set('Authorization', bearer(UserRole.COMPANY_STAFF))
      .expect(200);

    expect(propertiesService.findAll).toHaveBeenCalledTimes(1);
  });

  it('forbids COMPANY_ADMIN from super-admin-only audit route', async () => {
    await request(app.getHttpServer())
      .get('/admin/audit-logs')
      .set('Authorization', bearer(UserRole.COMPANY_ADMIN))
      .expect(403);
  });

  it('allows SUPER_ADMIN to super-admin-only audit route', async () => {
    await request(app.getHttpServer())
      .get('/admin/audit-logs')
      .set('Authorization', bearer(UserRole.SUPER_ADMIN, ''))
      .expect(200)
      .expect(({ body }) => {
        expect(body.message).toContain('Super-admin-only');
      });
  });
});
