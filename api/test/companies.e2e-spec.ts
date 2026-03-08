import { ForbiddenException, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { RolesGuard } from '../src/auth/roles.guard';
import { createSessionToken } from '../src/auth/session-token';
import { UserRole } from '../src/auth/roles.enum';
import { CompaniesController } from '../src/companies/companies.controller';
import { CompaniesService } from '../src/companies/companies.service';

describe('Companies (e2e)', () => {
  let app: INestApplication<App>;

  const mockCompany = {
    id: 'company-a',
    name: 'Test Company',
    email: 'test@company.com',
  };

  const companiesService = {
    findOne: jest.fn().mockImplementation((id, actor) => {
      if (actor.role !== 'SUPER_ADMIN' && actor.companyId !== id) {
        throw new ForbiddenException('You cannot access this company profile.');
      }
      return Promise.resolve(mockCompany);
    }),
    update: jest.fn().mockImplementation((id, data, actor) => {
      if (actor.role !== 'SUPER_ADMIN' && actor.companyId !== id) {
        throw new ForbiddenException('You cannot update this company profile.');
      }
      if (actor.role === 'COMPANY_STAFF') {
        throw new ForbiddenException(
          'Staff members cannot update company profile.',
        );
      }
      return Promise.resolve({ ...mockCompany, ...data });
    }),
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
      controllers: [CompaniesController],
      providers: [
        { provide: CompaniesService, useValue: companiesService },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /companies/:id', () => {
    it('returns 200 and company details for COMPANY_ADMIN of same company', () => {
      return request(app.getHttpServer())
        .get('/companies/company-a')
        .set('Authorization', bearer(UserRole.COMPANY_ADMIN, 'company-a'))
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('Test Company');
        });
    });

    it('returns 403 for COMPANY_ADMIN of different company', () => {
      // Since we mocked service.findOne to return mockCompany which has companyId company-a
      // and the service check would normally fail if companyId !== id.
      // But here the controller just calls the service.
      // The service implementation handles the check.
      return request(app.getHttpServer())
        .get('/companies/company-b')
        .set('Authorization', bearer(UserRole.COMPANY_ADMIN, 'company-a'))
        .expect(403);
    });
  });

  describe('PATCH /companies/:id', () => {
    it('allows COMPANY_ADMIN to update their company', () => {
      return request(app.getHttpServer())
        .patch('/companies/company-a')
        .set('Authorization', bearer(UserRole.COMPANY_ADMIN, 'company-a'))
        .send({ name: 'Updated Company' })
        .expect(200);
    });

    it('forbids COMPANY_STAFF from updating', () => {
      return request(app.getHttpServer())
        .patch('/companies/company-a')
        .set('Authorization', bearer(UserRole.COMPANY_STAFF, 'company-a'))
        .send({ name: 'Fail' })
        .expect(403);
    });
  });
});
