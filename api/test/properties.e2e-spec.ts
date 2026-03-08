import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { RolesGuard } from '../src/auth/roles.guard';
import { createSessionToken } from '../src/auth/session-token';
import { UserRole } from '../src/auth/roles.enum';
import { PropertiesController } from '../src/properties/properties.controller';
import { PropertiesService } from '../src/properties/properties.service';

describe('Properties (e2e)', () => {
  let app: INestApplication<App>;

  const mockProperty = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Property',
    address: '123 Main St',
    companyId: 'company-a',
  };

  const propertiesService = {
    findAll: jest.fn().mockResolvedValue([mockProperty]),
    findOne: jest.fn().mockResolvedValue(mockProperty),
    create: jest.fn().mockResolvedValue(mockProperty),
    update: jest.fn().mockResolvedValue({ ...mockProperty, name: 'Updated' }),
    remove: jest.fn().mockResolvedValue({ id: 'p1-uuid' }),
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
      controllers: [PropertiesController],
      providers: [
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

  describe('GET /properties', () => {
    it('returns 200 and list of properties for COMPANY_ADMIN', () => {
      return request(app.getHttpServer())
        .get('/properties')
        .set('Authorization', bearer(UserRole.COMPANY_ADMIN))
        .expect(200)
        .expect((res) => {
          expect(res.body).toBeInstanceOf(Array);
          expect(res.body[0].name).toBe('Test Property');
        });
    });

    it('returns 401 without token', () => {
      return request(app.getHttpServer()).get('/properties').expect(401);
    });
  });

  describe('GET /properties/:id', () => {
    it('returns 200 and property details', () => {
      return request(app.getHttpServer())
        .get(`/properties/${mockProperty.id}`)
        .set('Authorization', bearer(UserRole.COMPANY_STAFF))
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(mockProperty.id);
        });
    });
  });

  describe('POST /properties', () => {
    it('allows COMPANY_ADMIN to create a property', () => {
      const newProperty = { name: 'New Prop', address: 'New Ave' };
      return request(app.getHttpServer())
        .post('/properties')
        .set('Authorization', bearer(UserRole.COMPANY_ADMIN))
        .send(newProperty)
        .expect(201);
    });

    it('forbids COMPANY_STAFF from creating a property', () => {
      return request(app.getHttpServer())
        .post('/properties')
        .set('Authorization', bearer(UserRole.COMPANY_STAFF))
        .send({ name: 'Fail' })
        .expect(403);
    });
  });

  describe('PATCH /properties/:id', () => {
    it('updates property for COMPANY_ADMIN', () => {
      return request(app.getHttpServer())
        .patch(`/properties/${mockProperty.id}`)
        .set('Authorization', bearer(UserRole.COMPANY_ADMIN))
        .send({ name: 'Updated' })
        .expect(200);
    });
  });

  describe('DELETE /properties/:id', () => {
    it('removes property for COMPANY_ADMIN', () => {
      return request(app.getHttpServer())
        .delete(`/properties/${mockProperty.id}`)
        .set('Authorization', bearer(UserRole.COMPANY_ADMIN))
        .expect(200);
    });

    it('forbids COMPANY_STAFF from deleting', () => {
      return request(app.getHttpServer())
        .delete(`/properties/${mockProperty.id}`)
        .set('Authorization', bearer(UserRole.COMPANY_STAFF))
        .expect(403);
    });
  });
});
