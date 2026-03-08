import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { RolesGuard } from '../src/auth/roles.guard';
import { createSessionToken } from '../src/auth/session-token';
import { UserRole } from '../src/auth/roles.enum';
import { LeasesController } from '../src/leases/leases.controller';
import { LeasesService } from '../src/leases/leases.service';

describe('Leases (e2e)', () => {
    let app: INestApplication<App>;

    const mockLease = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        startDate: '2024-01-01',
        endDate: '2025-01-01',
        rentAmount: 50000,
        tenantId: '550e8400-e29b-41d4-a716-446655440001',
        propertyId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'ACTIVE',
    };

    const leasesService = {
        findAll: jest.fn().mockResolvedValue([mockLease]),
        findOne: jest.fn().mockResolvedValue(mockLease),
        create: jest.fn().mockResolvedValue(mockLease),
        update: jest.fn().mockResolvedValue({ ...mockLease, rentAmount: 60000 }),
        remove: jest.fn().mockResolvedValue({ id: 'l1-uuid' }),
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
            controllers: [LeasesController],
            providers: [
                { provide: LeasesService, useValue: leasesService },
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

    describe('GET /leases', () => {
        it('returns 200 and list of leases', () => {
            return request(app.getHttpServer())
                .get('/leases')
                .set('Authorization', bearer(UserRole.COMPANY_ADMIN))
                .expect(200)
                .expect((res) => {
                    expect(res.body).toBeInstanceOf(Array);
                    expect(res.body[0].rentAmount).toBe(50000);
                });
        });

        it('supports filtering by tenantId', async () => {
            const tenantId = 'some-tenant-id';
            await request(app.getHttpServer())
                .get(`/leases?tenantId=${tenantId}`)
                .set('Authorization', bearer(UserRole.COMPANY_ADMIN))
                .expect(200);

            expect(leasesService.findAll).toHaveBeenCalledWith(
                expect.objectContaining({ role: UserRole.COMPANY_ADMIN }),
                tenantId,
            );
        });
    });

    describe('POST /leases', () => {
        it('allows COMPANY_ADMIN to create a lease', () => {
            const newLease = {
                startDate: '2024-02-01',
                rentAmount: 45000,
                tenantId: 't1-uuid',
                propertyId: 'p1-uuid',
            };
            return request(app.getHttpServer())
                .post('/leases')
                .set('Authorization', bearer(UserRole.COMPANY_ADMIN))
                .send(newLease)
                .expect(201);
        });
    });

    describe('PATCH /leases/:id', () => {
        it('updates lease for COMPANY_ADMIN', () => {
            return request(app.getHttpServer())
                .patch(`/leases/${mockLease.id}`)
                .set('Authorization', bearer(UserRole.COMPANY_ADMIN))
                .send({ rentAmount: 60000 })
                .expect(200);
        });
    });
});
