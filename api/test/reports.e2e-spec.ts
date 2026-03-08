import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { RolesGuard } from '../src/auth/roles.guard';
import { createSessionToken } from '../src/auth/session-token';
import { UserRole } from '../src/auth/roles.enum';
import { ReportsController } from '../src/reports/reports.controller';
import { ReportsService } from '../src/reports/reports.service';

describe('Reports (e2e)', () => {
  let app: INestApplication<App>;

  const reportsService = {
    getSummary: jest.fn().mockResolvedValue({
      properties: 2,
      units: 10,
      tenants: 5,
      activeLeases: 4,
    }),
    getOccupancy: jest
      .fn()
      .mockResolvedValue({ VACANT: 3, OCCUPIED: 7, UNDER_MAINTENANCE: 0 }),
    getRevenue: jest.fn().mockResolvedValue({ totalRevenue: 150000 }),
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
      controllers: [ReportsController],
      providers: [
        { provide: ReportsService, useValue: reportsService },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /reports/summary', () => {
    it('returns 200 and summary for COMPANY_ADMIN', () => {
      return request(app.getHttpServer())
        .get('/reports/summary')
        .set('Authorization', bearer(UserRole.COMPANY_ADMIN))
        .expect(200)
        .expect((res) => {
          expect(res.body.properties).toBe(2);
        });
    });

    it('forbids COMPANY_STAFF from summary', () => {
      return request(app.getHttpServer())
        .get('/reports/summary')
        .set('Authorization', bearer(UserRole.COMPANY_STAFF))
        .expect(403);
    });
  });

  describe('GET /reports/occupancy', () => {
    it('returns 200 and occupancy details', () => {
      return request(app.getHttpServer())
        .get('/reports/occupancy')
        .set('Authorization', bearer(UserRole.COMPANY_ADMIN))
        .expect(200);
    });
  });

  describe('GET /reports/revenue', () => {
    it('returns 200 and revenue details', () => {
      return request(app.getHttpServer())
        .get('/reports/revenue')
        .set('Authorization', bearer(UserRole.COMPANY_ADMIN))
        .expect(200);
    });
  });
});
