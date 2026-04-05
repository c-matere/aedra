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
import { FeedbackService } from './feedback.service';

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
  let menuRouterMock: any;

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
      sendDocumentTemplate: jest.fn(),
      sendDocument: jest.fn(),
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
      executeToolAction: jest.fn().mockResolvedValue({ success: true, action: 'noop', data: {} }),
      generateTakeoverAdvice: jest.fn().mockResolvedValue({
        text: 'I can generate a richer report. Should I proceed?',
        suggestions: [
          {
            label: 'Full report',
            tool: 'get_financial_report',
            args: { range: 'last_30_days' },
          },
        ],
      }),
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
        {
          provide: FeedbackService,
          useValue: {
            recordFeedback: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    service = moduleRef.get<AiWhatsappOrchestratorService>(
      AiWhatsappOrchestratorService,
    );
    menuRouterMock = moduleRef.get(MenuRouterService);
    // Mock groq transcription to avoid external calls
    (service as any).transcribeAudio = jest.fn();
  });

  afterEach(async () => {
    await moduleRef?.close();
  });

  it('resends the last cached report when user asks to resend report', async () => {
    const phone = '254782730463';
    const text = 'please resend the report';

    mockPrisma.chatHistory.findFirst.mockResolvedValue({
      id: 'chat1',
      companyId: 'c1',
      updatedAt: new Date(),
    });

    mockCache.get.mockImplementation(async (key: string) => {
      if (key.startsWith('lock:wa:')) return null;
      if (key === `last_report:${phone}`) return { text: 'REPORT TEXT', generatedFiles: [] };
      return null;
    });

    await service.handleIncomingWhatsapp(phone, text, undefined, undefined, 'wamid_x');

    expect(mockWhatsapp.sendTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({ to: phone, text: 'REPORT TEXT' }),
    );
    expect(mockAiService.chat).not.toHaveBeenCalled();
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

  it('handles "<name> profile" deterministically via tools (no LLM chat)', async () => {
    const phone = '254700000001';
    const text = 'mary atieno profile';

    mockPrisma.chatHistory.findFirst.mockResolvedValue({
      id: 'chat1',
      companyId: 'c1',
      updatedAt: new Date(),
    });

    mockAiService.executeToolAction.mockImplementation(async (name: string) => {
      if (name === 'search_tenants') {
        return {
          success: true,
          action: 'search_tenants',
          data: [{ id: 'tenant_1', firstName: 'Mary', lastName: 'Atieno' }],
        };
      }
      if (name === 'get_tenant_details') {
        return {
          success: true,
          action: 'get_tenant_details',
          data: { id: 'tenant_1', firstName: 'Mary', lastName: 'Atieno' },
        };
      }
      return { success: true, action: name, data: {} };
    });

    mockAiService.formatToolResponse.mockResolvedValue({
      text: 'Mary Atieno details',
      interactive: { type: 'button' },
    });

    await service.handleIncomingWhatsapp(phone, text);

    expect(mockAiService.executeToolAction).toHaveBeenCalledWith(
      'search_tenants',
      expect.objectContaining({ query: expect.any(String) }),
      expect.any(Object),
      expect.any(String),
      expect.any(String),
    );
    expect(mockAiService.executeToolAction).toHaveBeenCalledWith(
      'get_tenant_details',
      { tenantId: 'tenant_1' },
      expect.any(Object),
      expect.any(String),
      expect.any(String),
    );
    expect(mockAiService.chat).not.toHaveBeenCalled();
  });

  it('triggers takeover suggestions (permissioned) when menu result is too simple', async () => {
    const prev = process.env.WHATSAPP_LLM_TAKEOVER;
    process.env.WHATSAPP_LLM_TAKEOVER = 'true';

    const phone = '254700000002';
    const text = 'get_financial_report';

    mockPrisma.chatHistory.findFirst.mockResolvedValue({
      id: 'chat1',
      companyId: 'c1',
      updatedAt: new Date(),
    });

    menuRouterMock.routeMessage.mockResolvedValue({
      handled: true,
      tool: { name: 'get_financial_report', args: {} },
    });

    mockAiService.executeToolAction.mockResolvedValue({
      success: true,
      action: 'get_financial_report',
      data: {
        totals: { payments: 200000, expenses: 0, invoices: 0 },
        breakdown: { payments: [], expenses: [], invoices: [] },
      },
    });
    mockAiService.formatToolResponse.mockResolvedValue({
      text: 'Payments: 200,000',
      interactive: undefined,
    });

    await service.handleIncomingWhatsapp(phone, text);

    expect(mockAiService.generateTakeoverAdvice).toHaveBeenCalled();
    expect(mockWhatsapp.sendInteractiveMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        to: phone,
        interactive: { type: 'button' },
      }),
    );

    process.env.WHATSAPP_LLM_TAKEOVER = prev;
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

  it('should proceed with staged action when plan_approve is received', async () => {
    const phone = '254700000000';
    const text = 'plan_approve';
    const stagedData = {
      text: 'Send reminder to Bob Smith',
      classification: { intent: 'send_notification' },
      history: [],
      chatId: 'chat1',
      attachments: [],
    };

    mockStaging.retrieve.mockResolvedValue(stagedData);
    mockAiService.chat.mockResolvedValue({ response: 'Reminder sent!' });

    await service.handleIncomingWhatsapp(phone, text);

    expect(mockStaging.retrieve).toHaveBeenCalledWith(
      expect.any(String),
      'pending_action',
    );
    expect(mockAiService.chat).toHaveBeenCalledWith(
      [],
      stagedData.text,
      stagedData.chatId,
      expect.any(String),
      undefined,
      [],
      'en',
      stagedData.classification,
      phone,
    );
    expect(mockWhatsapp.sendTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Reminder sent!' }),
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

describe('AiWhatsappOrchestratorService - Menu Selections', () => {
  it('routes list_reply ids to MenuRouter without clearing selection state', async () => {
    const store = new Map<string, any>();
    const phone = '254700000000';
    const sender = { id: 'u1', role: UserRole.COMPANY_ADMIN, companyId: 'c1' };
    const tenantId = 'tenant-brian-002';

    const mockPrisma: any = {
      chatHistory: { findFirst: jest.fn(), create: jest.fn() },
      chatMessage: { create: jest.fn() },
      company: { findUnique: jest.fn() },
      property: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const mockWhatsapp: any = {
      identifySenderByPhone: jest.fn().mockResolvedValue(sender),
      getWhatsAppProfile: jest.fn().mockResolvedValue({ language: 'en' }),
      sendReaction: jest.fn(),
      sendTextMessage: jest.fn(),
      sendInteractiveMessage: jest.fn(),
    };

    const mockAiService: any = {
      chat: jest.fn(),
      getChatHistory: jest.fn().mockResolvedValue([]),
      executeToolAction: jest.fn().mockResolvedValue({ success: true, action: 'get_tenant_details', data: { ok: true } }),
      formatToolResponse: jest
        .fn()
        .mockResolvedValue({ text: 'tenant details', interactive: undefined }),
    };

    const mockCache: any = {
      get: jest.fn(async (key: string) => store.get(key)),
      set: jest.fn(async (key: string, value: any) => {
        store.set(key, value);
      }),
      del: jest.fn(async (key: string) => {
        store.delete(key);
      }),
    };

    // Seed selection state in session; active list exists but doesn't contain the id,
    // forcing the flow to rely on MenuRouter + session.lastResults.
    store.set(`ai_session:${sender.id}`, {
      awaitingSelection: 'tenant',
      lastResults: [{ id: tenantId, name: 'Brian Ochieng', type: 'tenant' }],
      userId: sender.id,
    });
    store.set(`list:${sender.id}`, { items: [], chatId: null });

    const moduleRef = await Test.createTestingModule({
      providers: [
        AiWhatsappOrchestratorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WhatsappService, useValue: mockWhatsapp },
        { provide: AiClassifierService, useValue: { classify: jest.fn() } },
        { provide: AiService, useValue: mockAiService },
        { provide: CACHE_MANAGER, useValue: mockCache },
        MenuRouterService,
        { provide: MainMenuService, useValue: { getMainMenu: jest.fn() } },
        {
          provide: WhatsAppFormatterService,
          useValue: {
            buildListMessage: jest.fn(),
            buildActionableEchoButtons: jest.fn(),
            buildButtonMessage: jest.fn(),
          },
        },
        { provide: QuorumBridgeService, useValue: {} },
        { provide: AiStagingService, useValue: { stage: jest.fn(), retrieve: jest.fn(), delete: jest.fn(), purge: jest.fn() } },
        { provide: WaCrudButtonsService, useValue: { buildPlanButtons: jest.fn() } },
        { provide: WorkflowEngine, useValue: { hasHandlers: jest.fn().mockReturnValue(true) } },
        { provide: NextStepOrchestrator, useValue: {} },
        { provide: ErrorRecoveryService, useValue: { buildInteractiveErrorRecovery: jest.fn() } },
        { provide: FeedbackService, useValue: { recordFeedback: jest.fn() } },
      ],
    }).compile();

    const service = moduleRef.get(AiWhatsappOrchestratorService);
    (service as any).transcribeAudio = jest.fn();

    await service.handleIncomingWhatsapp(phone, tenantId, undefined, undefined, 'wamid1');

    expect(mockAiService.executeToolAction).toHaveBeenCalledWith(
      'get_tenant_details',
      { tenantId },
      expect.objectContaining({ userId: sender.id, phone }),
      sender.role,
      'en',
    );
    expect(mockAiService.chat).not.toHaveBeenCalled();
    expect(mockWhatsapp.sendTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({ to: phone, text: 'tenant details' }),
    );

    await moduleRef.close();
  });
});
