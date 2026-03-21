import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { createSessionToken } from './../src/auth/session-token';
import { UserRole } from './../src/auth/roles.enum';

const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true';

(runIntegration ? describe : describe.skip)('AI (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let companyId: string;
  let userId: string;
  let propertyId: string;
  let tenantId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:4543/aedra?schema=public';
    process.env.AI_TEST_MODE = 'direct-only';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);

    const company = await prisma.company.create({
      data: { name: 'AI Test Co' },
    });
    companyId = company.id;

    const user = await prisma.user.create({
      data: {
        email: `ai-test-${Date.now()}@example.com`,
        password: 'test',
        firstName: 'AI',
        lastName: 'Tester',
        role: UserRole.COMPANY_ADMIN,
        companyId,
      },
    });
    userId = user.id;

    const property = await prisma.property.create({
      data: {
        name: 'Test Property One',
        address: '123 Test Ave',
        companyId,
      },
    });
    propertyId = property.id;

    const tenant = await prisma.tenant.create({
      data: {
        firstName: 'Zara',
        lastName: 'Brown',
        companyId,
        propertyId,
      },
    });
    tenantId = tenant.id;

    token = createSessionToken({
      userId,
      role: UserRole.COMPANY_ADMIN,
      companyId,
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.chatMessage.deleteMany({
        where: { chatHistory: { companyId } },
      });
      await prisma.chatHistory.deleteMany({
        where: { companyId },
      });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
      await prisma.property.deleteMany({ where: { id: propertyId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.company.deleteMany({ where: { id: companyId } });
    }

    if (app) {
      await app.close();
    }
  });

  it('lists properties via direct intent', async () => {
    const res = await request(app.getHttpServer())
      .post('/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ history: [], message: 'what properties do we have' })
      .expect(201);

    expect(res.body.response).toContain('Test Property One');
    expect(res.body.response).toContain(propertyId);
  });

  it('searches companies with multiple words', async () => {
    // Requires Super Admin or being member. The test user is COMPANY_ADMIN of 'AI Test Co'.
    // However, search_companies in ai.service.ts uses context.isSuperAdmin check.
    // Let's see if we can test it. The test user is the one who created it in beforeAll?
    // No, it's COMPANY_ADMIN.

    const res = await request(app.getHttpServer())
      .post('/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ history: [], message: 'search companies named "ai co"' })
      .expect(201);

    expect(res.body.response).toContain('AI Test Co');
  });

  it('selects a company workspace', async () => {
    const res = await request(app.getHttpServer())
      .post('/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ history: [], message: `use company ${companyId}` })
      .expect(201);

    expect(res.body.response).toContain('Workspace set to AI Test Co');
  });

  it('counts properties via direct intent', async () => {
    const res = await request(app.getHttpServer())
      .post('/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ history: [], message: 'how many houses do i have' })
      .expect(201);

    expect(res.body.response).toContain('You have 1 properties.');
  });

  it('searches tenants by name via direct intent', async () => {
    const res = await request(app.getHttpServer())
      .post('/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ history: [], message: 'do we have a tenant called zara brown' })
      .expect(201);

    expect(res.body.response).toContain('Zara Brown');
    expect(res.body.response).toContain(tenantId);
  });
});
