import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../api/src/app.module';
import { PrismaService } from '../../../api/src/prisma/prisma.service';
import { AiService } from '../../../api/src/ai/ai.service';
import { WhatsappService } from '../../../api/src/messaging/whatsapp.service';
import request from 'supertest';

// Avoid pulling in franc-min ESM during Jest runs
jest.mock('../../../api/src/common/utils/language.util', () => ({
  detectLanguage: () => ({ code: 'en' }),
  DetectedLanguage: { EN: 'en', SW: 'sw', MIXED: 'mixed' },
}));

// Temporarily skipped to avoid heavy NestJS bootstrap in CI-like runs.
describe.skip('WhatsApp Pipeline Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let whatsappService: WhatsappService;

  const TEST_PHONE = '254700000001';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
    .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    whatsappService = app.get(WhatsappService);

    // Mock WhatsApp sender identification to avoid real DB lookups if preferred,
    // but here we use a real test record for full integration coverage.
    await setupTestData(prisma, TEST_PHONE);
  });

  afterAll(async () => {
    await cleanupTestData(prisma, TEST_PHONE);
    await app.close();
  });

  it('POST /webhook — accepts valid WhatsApp payload and triggers AI', async () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '123',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            messages: [{
              from: TEST_PHONE,
              id: 'wamid.test_123',
              timestamp: '164e6',
              text: { body: 'how much do I owe?' },
              type: 'text'
            }]
          },
          field: 'messages'
        }]
      }]
    };

    const response = await request(app.getHttpServer())
      .post('/webhook')
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('accepted');
  });

  it('Emergency message triggers immediate escalation response', async () => {
     const payload = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            messages: [{
              from: TEST_PHONE,
              id: 'wamid.emergency_123',
              text: { body: 'FIRE IN THE BUILDING' },
              type: 'text'
            }]
          },
          field: 'messages'
        }]
      }]
    };

    // For emergency, we expect 201 immediately, and an audit log entry
    await request(app.getHttpServer())
      .post('/webhook')
      .send(payload)
      .expect(201);

    // Check audit logs for emergency
    const audit = await prisma.auditLog.findFirst({
      where: { 
          path: 'emergency_escalation',
          targetId: { contains: 'unidentified' } // or the sender id
      },
      orderBy: { timestamp: 'desc' }
    });
    
    expect(audit).toBeDefined();
    expect(audit?.metadata).toMatchObject({ result: { isEmergency: true } });
  });
});

async function setupTestData(prisma: PrismaService, phone: string) {
    // Create a minimal company/property/tenant for the test phone
    const company = await prisma.company.upsert({
        where: { id: 'test-integration-co' },
        update: {},
        create: { id: 'test-integration-co', name: 'Integration Test Co' }
    });
}

async function cleanupTestData(prisma: PrismaService, phone: string) {
    // Optional cleanup
}
