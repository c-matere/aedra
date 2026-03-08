import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { RolesGuard } from '../src/auth/roles.guard';
import { createSessionToken } from '../src/auth/session-token';
import { UserRole } from '../src/auth/roles.enum';
import { TenantsController } from '../src/tenants/tenants.controller';
import { TenantsService } from '../src/tenants/tenants.service';

describe('Tenants (e2e)', () => {
    let app: INestApplication<App>;

    const mockTenant = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        propertyId: '550e8400-e29b-41d4-a716-446655440000',
        companyId: 'company-a',
    };

    const tenantsService = {
        findAll: jest.fn().mockResolvedValue([mockTenant]),
        findOne: jest.fn().mockResolvedValue(mockTenant),
        create: jest.fn().mockResolvedValue(mockTenant),
        update: jest.fn().mockResolvedValue({ ...mockTenant, firstName: 'Updated' }),
        remove: jest.fn().mockResolvedValue({ id: 't1-uuid' }),
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
            controllers: [TenantsController],
            providers: [
                { provide: TenantsService, useValue: tenantsService },
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

    describe('GET /tenants', () => {
        it('returns 200 and list of tenants', () => {
            return request(app.getHttpServer())
                .get('/tenants')
                .set('Authorization', bearer(UserRole.COMPANY_ADMIN))
                .expect(200)
                .expect((res) => {
                    expect(res.body).toBeInstanceOf(Array);
                    expect(res.body[0].firstName).toBe('John');
                });
        });
    });

    describe('GET /tenants/:id', () => {
        it('returns 200 and tenant details', () => {
            return request(app.getHttpServer())
                .get(`/tenants/${mockTenant.id}`)
                .set('Authorization', bearer(UserRole.COMPANY_ADMIN))
                .expect(200)
                .expect((res) => {
                    expect(res.body.id).toBe(mockTenant.id);
                });
        });
    });

    describe('POST /tenants', () => {
        it('allows COMPANY_ADMIN to create a tenant', () => {
            const newTenant = {
                firstName: 'Jane',
                lastName: 'Doe',
                propertyId: 'p1-uuid',
            };
            return request(app.getHttpServer())
                .post('/tenants')
                .set('Authorization', bearer(UserRole.COMPANY_ADMIN))
                .send(newTenant)
                .expect(201);
        });
    });

    describe('DELETE /tenants/:id', () => {
        it('removes tenant for COMPANY_ADMIN', () => {
            return request(app.getHttpServer())
                .delete(`/tenants/${mockTenant.id}`)
                .set('Authorization', bearer(UserRole.COMPANY_ADMIN))
                .expect(200);
        });
    });
});
