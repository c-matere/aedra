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
import { WaCrudButtonsService } from './wa-crud-buttons.service';
import { WorkflowEngine } from '../workflows/workflow.engine';

describe('AiWhatsappOrchestratorService - Actionable Echo', () => {
  let service: AiWhatsappOrchestratorService;
  let moduleRef: TestingModule;
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
      chatHistory: {
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'chat1' }),
      },
      chatMessage: { create: jest.fn() },
      company: { findUnique: jest.fn() },
      property: { findMany: jest.fn().mockResolvedValue([]) },
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
      formatToolResponse: jest
        .fn()
        .mockResolvedValue({ text: 'ok', interactive: undefined }),
      executeTool: jest.fn().mockResolvedValue({}),
    };
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };
    mockStaging = {
      stage: jest.fn(),
      retrieve: jest.fn(),
      delete: jest.fn(),
      purge: jest.fn(),
    };
    mockFormatter = {
      buildActionableEchoButtons: jest.fn().mockReturnValue({ type: 'button' }),
      buildButtonMessage: jest.fn().mockReturnValue({ type: 'button' }),
    };

    moduleRef = await Test.createTestingModule({
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
        { provide: WaCrudButtonsService, useValue: { buildPlanButtons: jest.fn() } },
        { provide: WorkflowEngine, useValue: { hasHandlers: jest.fn().mockReturnValue(true) } },
        { provide: NextStepOrchestrator, useValue: {} },
        {
          provide: ErrorRecoveryService,
          useValue: {
            buildInteractiveErrorRecovery: jest.fn().mockReturnValue({
              errorId: 'e1',
              message: 'error',
              action: 'CANCEL',
            }),
          },
        },
      ],
    }).compile();

    service = moduleRef.get<AiWhatsappOrchestratorService>(
      AiWhatsappOrchestratorService,
    );
    // Mock groq transcription to avoid external calls
    (service as any).transcribeAudio = jest.fn();
  });

  afterEach(async () => {
    await moduleRef?.close();
  });

  it('should trigger Actionable Echo for write intents', async () => {
    const phone = '254700000000';
    const text = 'Record payment of 50k for Unit A1';

    mockClassifier.classify.mockResolvedValue({
      intent: 'record_payment',
      complexity: 2,
      executionMode: 'LIGHT_COMPOSE',
      language: 'en',
      reason: 'Payment signal',
      confidence: 0.9,
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

  it('should use direct property lookup for "interested in house N" (skip classifier)', async () => {
    const phone = '254700000000';
    const text = 'im intrested in house 32:"House No. 032"';

    mockPrisma.property.findMany.mockResolvedValue([
      { id: 'p1', name: 'House No. 032' },
    ]);
    mockAiService.executeTool.mockResolvedValue({ id: 'p1', name: 'House No. 032' });
    mockAiService.formatToolResponse.mockResolvedValue({
      text: 'House details',
      interactive: undefined,
    });

    await service.handleIncomingWhatsapp(phone, text);

    expect(mockClassifier.classify).not.toHaveBeenCalled();
    expect(mockAiService.executeTool).toHaveBeenCalledWith(
      'get_property_details',
      { propertyId: 'p1' },
      expect.objectContaining({ phone }),
    );
    expect(mockWhatsapp.sendTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({ to: phone, text: 'House details' }),
    );
  });

  it('should ask to disambiguate when message mentions a house but intent looks like a write guess', async () => {
    const phone = '254700000000';
    const text = 'house 32';

    mockClassifier.classify.mockResolvedValue({
      intent: 'add_tenant',
      complexity: 2,
      executionMode: 'ORCHESTRATED',
      language: 'en',
      reason: 'LLM guess',
      confidence: 0.55,
    });

    await service.handleIncomingWhatsapp(phone, text);

    expect(mockStaging.stage).toHaveBeenCalledWith(
      expect.any(String),
      'pending_intent_choice',
      expect.objectContaining({ text }),
    );
    expect(mockFormatter.buildButtonMessage).toHaveBeenCalled();
    expect(mockWhatsapp.sendInteractiveMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        to: phone,
        interactive: { type: 'button' },
      }),
    );
    expect(mockFormatter.buildActionableEchoButtons).not.toHaveBeenCalled();
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

  it('should run chat with chosen intent when intent_choose is received', async () => {
    const phone = '254700000000';
    const text = 'intent_choose:get_property_details';
    const stagedData = {
      text: 'im intrested in house 32',
      classification: { intent: 'add_tenant', confidence: 0.4 },
      history: [],
      chatId: 'chat1',
      attachments: [],
    };

    mockStaging.retrieve.mockResolvedValue(stagedData);
    mockAiService.chat.mockResolvedValue({ response: 'Details...', interactive: undefined });

    await service.handleIncomingWhatsapp(phone, text);

    expect(mockStaging.retrieve).toHaveBeenCalledWith(
      expect.any(String),
      'pending_intent_choice',
    );
    expect(mockAiService.chat).toHaveBeenCalledWith(
      [],
      stagedData.text,
      stagedData.chatId,
      expect.any(String),
      undefined,
      [],
      'en',
      expect.objectContaining({
        intent: 'get_property_details',
        executionMode: 'DIRECT_LOOKUP',
        confidence: 1,
      }),
      phone,
    );
    expect(mockStaging.delete).toHaveBeenCalledWith(
      expect.any(String),
      'pending_intent_choice',
    );
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
