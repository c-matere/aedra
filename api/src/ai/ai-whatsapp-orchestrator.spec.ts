import { Test, TestingModule } from '@nestjs/testing';
import { AiWhatsappOrchestratorService } from './ai-whatsapp-orchestrator.service';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../messaging/whatsapp.service';
import { AiClassifierService } from './ai-classifier.service';
import { AiService } from './ai.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { MenuRouterService } from './menu-router.service';
import { MainMenuService } from './main-menu.service';
import { WhatsAppFormatterService } from './whatsapp-formatter.service';
import { QuorumBridgeService } from './quorum-bridge.service';
import { AiStagingService } from './ai-staging.service';
import { UserRole } from '../auth/roles.enum';
import { NextStepOrchestrator } from './next-step-orchestrator.service';
import { ErrorRecoveryService } from './error-recovery.service';

describe('AiWhatsappOrchestratorService - Actionable Echo', () => {
  let service: AiWhatsappOrchestratorService;
  let mockPrisma: any;
  let mockWhatsapp: any;
  let mockClassifier: any;
  let mockAiService: any;
  let mockCache: any;
  let mockStaging: any;
  let mockFormatter: any;

  beforeEach(async () => {
    mockPrisma = {
      identifySenderByPhone: jest.fn(),
      chatHistory: { findFirst: jest.fn(), create: jest.fn() },
      chatMessage: { create: jest.fn() },
      company: { findUnique: jest.fn() },
    };
    mockWhatsapp = {
      identifySenderByPhone: jest.fn().mockResolvedValue({
        id: 'u1',
        role: UserRole.COMPANY_ADMIN,
        companyId: 'c1',
      }),
      getWhatsAppProfile: jest.fn().mockResolvedValue({ language: 'en' }),
      sendReaction: jest.fn(),
      sendTextMessage: jest.fn(),
      sendInteractiveMessage: jest.fn(),
    };
    mockClassifier = {
      classify: jest.fn(),
    };
    mockAiService = {
      chat: jest.fn(),
      getChatHistory: jest.fn().mockResolvedValue([]),
      formatToolResponse: jest.fn(),
      executeTool: jest.fn(),
    };
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };
    mockStaging = {
      stage: jest.fn(),
      retrieve: jest.fn(),
      purge: jest.fn(),
    };
    mockFormatter = {
      buildActionableEchoButtons: jest.fn().mockReturnValue({ type: 'button' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiWhatsappOrchestratorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WhatsappService, useValue: mockWhatsapp },
        { provide: AiClassifierService, useValue: mockClassifier },
        { provide: AiService, useValue: mockAiService },
        { provide: CACHE_MANAGER, useValue: mockCache },
        {
          provide: MenuRouterService,
          useValue: {
            routeMessage: jest.fn().mockResolvedValue({ handled: false }),
          },
        },
        { provide: MainMenuService, useValue: {} },
        { provide: WhatsAppFormatterService, useValue: mockFormatter },
        { provide: QuorumBridgeService, useValue: {} },
        { provide: AiStagingService, useValue: mockStaging },
        { provide: NextStepOrchestrator, useValue: {} },
        { provide: ErrorRecoveryService, useValue: {} },
      ],
    }).compile();

    service = module.get<AiWhatsappOrchestratorService>(
      AiWhatsappOrchestratorService,
    );
    // Mock groq transcription to avoid external calls
    (service as any).transcribeAudio = jest.fn();
  });

  it('should trigger Actionable Echo for write intents', async () => {
    const phone = '254700000000';
    const text = 'Record payment of 50k for Unit A1';

    mockClassifier.classify.mockResolvedValue({
      intent: 'record_payment',
      complexity: 2,
      executionMode: 'LIGHT_COMPOSE',
      language: 'en',
    });

    await service.handleIncomingWhatsapp(phone, text);

    // Verify staging happened
    expect(mockStaging.stage).toHaveBeenCalled();
    // Verify buttons were sent
    expect(mockFormatter.buildActionableEchoButtons).toHaveBeenCalled();
    expect(mockWhatsapp.sendInteractiveMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        to: phone,
        interactive: { type: 'button' },
      }),
    );
    // Verify aiService.chat was NOT called yet
    expect(mockAiService.chat).not.toHaveBeenCalled();
  });

  it('should proceed with action when correction_proceed is received', async () => {
    const phone = '254700000000';
    const text = 'correction_proceed';
    const stagedData = {
      text: 'Original request',
      classification: { intent: 'record_payment' },
      history: [],
      chatId: 'chat1',
      attachments: [],
    };

    mockStaging.retrieve.mockResolvedValue(stagedData);
    mockAiService.chat.mockResolvedValue({ response: 'Payment recorded!' });

    await service.handleIncomingWhatsapp(phone, text);

    expect(mockStaging.retrieve).toHaveBeenCalledWith(
      expect.any(String),
      'pending_action',
    );
    expect(mockAiService.chat).toHaveBeenCalledWith(
      [],
      'Original request',
      'chat1',
      expect.any(String),
      undefined,
      [],
      'en',
      stagedData.classification,
      phone,
    );
    expect(mockWhatsapp.sendTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Payment recorded!' }),
    );
    expect(mockStaging.purge).toHaveBeenCalled();
  });

  it('should cancel action when correction_cancel is received', async () => {
    const phone = '254700000000';
    const text = 'correction_cancel';

    await service.handleIncomingWhatsapp(phone, text);

    expect(mockStaging.purge).toHaveBeenCalled();
    expect(mockWhatsapp.sendTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('cancelled'),
      }),
    );
  });
});
