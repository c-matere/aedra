import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { UserRole } from './../src/auth/roles.enum';
import { AiWhatsappOrchestratorService } from './../src/ai/ai-whatsapp-orchestrator.service';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

describe('AI Onboarding (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cacheManager: Cache;
  let orchestrator: AiWhatsappOrchestratorService;
  let companyId: string;
  let userId: string;
  const phone = '254712345678';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    cacheManager = app.get(CACHE_MANAGER);
    orchestrator = app.get(AiWhatsappOrchestratorService);

    const company = await prisma.company.create({
      data: { name: 'Onboarding Test Co' },
    });
    companyId = company.id;

    const user = await prisma.user.create({
      data: {
        email: `onboard-test-${Date.now()}@example.com`,
        password: 'test',
        firstName: 'Onboard',
        lastName: 'Tester',
        role: UserRole.COMPANY_ADMIN,
        phone,
        companyId,
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({ where: { companyId } });
      await prisma.property.deleteMany({ where: { companyId } });
      await prisma.company.delete({ where: { id: companyId } });
    }
    await app.close();
  });

  it('detects ONBOARDING as high-stakes and requests confirmation without hallucinating success', async () => {
    // Mock a property creation request
    const message = 'I want to create a property called "Skyline Plaza" with 20 units at Westlands';
    
    // We call the orchestrator directly to simulate WhatsApp flow
    const result = await orchestrator.handleIncomingWhatsapp(phone, message, undefined, undefined, 'wamid.123');
    
    // The response should NOT say "Successfully created" because it requires confirmation
    expect(result.response).not.toContain('Successfully created');
    expect(result.response).not.toContain('Success!');
    expect(result.response).toContain('I need your confirmation');
    
    // It should include interactive buttons (from our new orchestrator logic)
    // Note: orchestrator sends buttons via whatsappService mock/real.
    // In e2e, we check if result.interactive was populated.
    expect(result.interactive).toBeDefined();
    expect(result.interactive.type).toBe('button');
    expect(result.interactive.action.buttons[0].reply.id).toBe('plan_approve');
  }, 30000);

  it('prevents duplicate processing of the same messageId', async () => {
    const message = 'Hello again';
    const messageId = 'wamid.duplicate.test';
    
    // First call
    await orchestrator.handleIncomingWhatsapp(phone, message, undefined, undefined, messageId);
    
    // Second call with same messageId
    const result = await orchestrator.handleIncomingWhatsapp(phone, message, undefined, undefined, messageId);
    
    // Should return undefined (skipped)
    expect(result).toBeUndefined();
  });
});
