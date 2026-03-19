import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { AiService } from './../src/ai/ai.service';
import { WhatsappService } from './../src/messaging/whatsapp.service';
import { UserRole } from './../src/auth/roles.enum';

describe('WhatsApp Onboarding (e2e)', () => {
  let app: INestApplication;
  let aiService: AiService;
  let whatsappService: WhatsappService;
  let prisma: PrismaService;

  const phone = '254700000000';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    aiService = app.get(AiService);
    whatsappService = app.get(WhatsappService);
    prisma = app.get(PrismaService);

    // Clean up
    await prisma.chatMessage.deleteMany({});
    await prisma.chatHistory.deleteMany({});
    await prisma.whatsAppProfile.deleteMany({ where: { phone } });
    await prisma.whatsAppLog.deleteMany({ where: { to: phone } });
  });

  afterAll(async () => {
    await prisma.whatsAppProfile.deleteMany({ where: { phone } });
    await prisma.whatsAppLog.deleteMany({ where: { to: phone } });
    await app.close();
  });

  it('Flow 1: New User -> Language Prompt', async () => {
    await aiService.handleIncomingWhatsapp(phone, 'Hi');
    
    // Check if it sent the language selection message
    const logs = await prisma.whatsAppLog.findMany({ where: { to: phone } });
    expect(logs.length).toBe(1);
    expect(logs[0].templateName).toBe('FREE_TEXT');
    
    // We can't easily check the content of the message from WhatsAppLog as it doesn't store the text
    // but we can check if a profile was created
    const profile = await prisma.whatsAppProfile.findUnique({ where: { phone } });
    expect(profile).toBeDefined();
    expect(profile?.language).toBeNull();
  });

  it('Flow 2: Select English', async () => {
    await aiService.handleIncomingWhatsapp(phone, '1');
    
    const profile = await prisma.whatsAppProfile.findUnique({ where: { phone } });
    expect(profile?.language).toBe('en');
  });

  it('Flow 3: Send "hi" as Guest -> Show Unidentified Help', async () => {
    await aiService.handleIncomingWhatsapp(phone, 'hi');
    
    // Check if logs increased
    const logs = await prisma.whatsAppLog.findMany({ where: { to: phone } });
    expect(logs.length).toBe(3); // 1 (selection), 1 (en confirmation), 1 (help)
  });

  it('Flow 4: Identify as Tenant -> Show Tenant Help', async () => {
    const tenantPhone = '254711111111';
    
    // Create a tenant
    const company = await prisma.company.create({ data: { name: 'Test Co' } });
    const property = await prisma.property.create({ data: { name: 'Test Prop', companyId: company.id } });
    await prisma.tenant.create({
      data: {
        firstName: 'Test',
        lastName: 'Tenant',
        phone: tenantPhone,
        companyId: company.id,
        propertyId: property.id
      }
    });

    // Set language for this phone
    await prisma.whatsAppProfile.create({ data: { phone: tenantPhone, language: 'en' } });

    await aiService.handleIncomingWhatsapp(tenantPhone, 'help');

    const logs = await prisma.whatsAppLog.findMany({ where: { to: tenantPhone } });
    expect(logs.length).toBe(1);

    // Clean up
    await prisma.tenant.deleteMany({ where: { phone: tenantPhone } });
    await prisma.property.deleteMany({ where: { id: property.id } });
    await prisma.company.deleteMany({ where: { id: company.id } });
    await prisma.whatsAppProfile.deleteMany({ where: { phone: tenantPhone } });
  });
});
