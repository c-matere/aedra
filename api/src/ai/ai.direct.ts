import { renderTemplate } from './templates';
import { UserRole } from '../auth/roles.enum';
import { getSessionUid } from './ai-tool-selector.util';
import type { Cache } from 'cache-manager';

const normalizeText = (message: string) =>
  (message || '').toLowerCase().replace(/\s+/g, ' ').trim();

const timeOfDay = () => {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
};

const swahiliGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Habari za asubuhi';
  if (h < 18) return 'Habari za mchana';
  return 'Habari za jioni';
};

type Lang = 'EN' | 'SW';

type QuickRole = 'SUPER_ADMIN' | 'AGENT' | 'TENANT' | 'LANDLORD';

interface AgentContext {
  unpaidCount: number;
  overdueCount?: number;
}

interface TenantContext {
  balanceDue: number;
  currentMonth: string;
}

interface LandlordContext {
  portfolioName: string;
  collectionRate: number;
  vacantCount: number;
}

type ActionTemplate =
  | ((language: Lang) => {
      greeting: string;
      subtitle: string;
      actions: { key: string; label: string }[];
    })
  | Record<
      Lang,
      (
        name: string,
        ctx: any,
      ) => {
        greeting: string;
        subtitle: string;
        actions: { key: string; label: string }[];
      }
    >;

interface PendingConfirmation {
  action: string;
  context: any;
  expiresAt: number;
  options?: Record<string, string>; // digit-based overrides
}

interface SessionState {
  userId: string;
  lastIntent?: string;
  pendingConfirmation?: PendingConfirmation;
  lastActionMenu?: {
    role: QuickRole;
    options: Record<string, string>;
  };
  lastResults?: { id: string; name: string; type: string }[];
}

const GREETING_TEMPLATES: Record<
  QuickRole,
  Record<
    Lang,
    (
      name: string,
      ctx: any,
    ) => {
      greeting: string;
      subtitle: string;
      actions: { key: string; label: string }[];
    }
  >
> = {
  SUPER_ADMIN: {
    EN: (name: string) => ({
      greeting: `👋 Welcome back, ${name}.`,
      subtitle: 'Platform overview — what would you like to do?',
      actions: [
        { key: '1', label: 'List all companies' },
        { key: '2', label: 'Switch active company' },
        { key: '3', label: 'Generate platform report' },
        { key: '4', label: 'View system health' },
      ],
    }),
    SW: (name: string) => ({
      greeting: `👋 Karibu tena, ${name}.`,
      subtitle: 'Ungependa kufanya nini leo?',
      actions: [
        { key: '1', label: 'Orodha ya kampuni zote' },
        { key: '2', label: 'Badilisha kampuni inayofanya kazi' },
        { key: '3', label: 'Tengeneza ripoti ya mfumo' },
        { key: '4', label: 'Angalia hali ya mfumo' },
      ],
    }),
  },
  AGENT: {
    EN: (name: string, ctx: AgentContext = { unpaidCount: 0 }) => ({
      greeting: `👋 Good ${timeOfDay()}, ${name}.`,
      subtitle:
        ctx.unpaidCount > 0
          ? `⚠ ${ctx.unpaidCount} unpaid tenants this month.`
          : '✅ Collection on track this month.',
      actions: [
        { key: '1', label: `Check unpaid (${ctx.unpaidCount})` },
        { key: '2', label: 'Send rent reminders' },
        { key: '3', label: 'Generate landlord report' },
        { key: '4', label: 'Log maintenance issue' },
        { key: '5', label: 'Check vacancies' },
      ],
    }),
    SW: (name: string, ctx: AgentContext = { unpaidCount: 0 }) => ({
      greeting: `👋 ${swahiliGreeting()}, ${name}.`,
      subtitle:
        ctx.unpaidCount > 0
          ? `⚠ Wapangaji ${ctx.unpaidCount} hawajalipa mwezi huu.`
          : '✅ Ukusanyaji uko sawa mwezi huu.',
      actions: [
        { key: '1', label: `Angalia wasioplipa (${ctx.unpaidCount})` },
        { key: '2', label: 'Tuma vikumbusho vya pango' },
        { key: '3', label: 'Tengeneza ripoti ya mmiliki' },
        { key: '4', label: 'Andika tatizo la matengenezo' },
        { key: '5', label: 'Angalia vitengo vya wazi' },
      ],
    }),
  },
  TENANT: {
    EN: (
      name: string,
      ctx: TenantContext = { balanceDue: 0, currentMonth: '' },
    ) => ({
      greeting: `👋 Hi ${name}.`,
      subtitle:
        ctx.balanceDue > 0
          ? `💳 KES ${ctx.balanceDue.toLocaleString()} due for ${ctx.currentMonth || 'this month'}.`
          : `✅ You're all paid up for ${ctx.currentMonth || 'this month'}.`,
      actions: [
        { key: '1', label: 'Check my balance' },
        { key: '2', label: 'Get my receipt' },
        { key: '3', label: 'Report a maintenance issue' },
        { key: '4', label: 'Request payment statement' },
      ],
    }),
    SW: (
      name: string,
      ctx: TenantContext = { balanceDue: 0, currentMonth: '' },
    ) => ({
      greeting: `👋 Habari ${name}.`,
      subtitle:
        ctx.balanceDue > 0
          ? `💳 KES ${ctx.balanceDue.toLocaleString()} inadaiwa kwa ${ctx.currentMonth || 'mwezi huu'}.`
          : `✅ Umelipa kikamilifu kwa ${ctx.currentMonth || 'mwezi huu'}.`,
      actions: [
        { key: '1', label: 'Angalia salio langu' },
        { key: '2', label: 'Pata risiti yangu' },
        { key: '3', label: 'Ripoti tatizo la nyumba' },
        { key: '4', label: 'Omba taarifa ya malipo' },
      ],
    }),
  },
  LANDLORD: {
    EN: (
      name: string,
      ctx: LandlordContext = {
        portfolioName: '',
        collectionRate: 0,
        vacantCount: 0,
      },
    ) => ({
      greeting: `👋 Good ${timeOfDay()}, ${name}.`,
      subtitle: `${ctx.portfolioName || 'Portfolio'} — ${ctx.collectionRate}% collected this month.`,
      actions: [
        { key: '1', label: 'View collection status' },
        { key: '2', label: 'Request full report' },
        { key: '3', label: `Check vacancies (${ctx.vacantCount})` },
        { key: '4', label: 'Contact managing agent' },
      ],
    }),
    SW: (
      name: string,
      ctx: LandlordContext = {
        portfolioName: '',
        collectionRate: 0,
        vacantCount: 0,
      },
    ) => ({
      greeting: `👋 ${swahiliGreeting()}, ${name}.`,
      subtitle: `${ctx.portfolioName || 'Portfolio'} — ${ctx.collectionRate}% zimekusanywa mwezi huu.`,
      actions: [
        { key: '1', label: 'Angalia makusanyo' },
        { key: '2', label: 'Omba ripoti kamili' },
        { key: '3', label: `Angalia nafasi wazi (${ctx.vacantCount})` },
        { key: '4', label: 'Wasiliana na wakala' },
      ],
    }),
  },
};

const QUICK_ACTION_MAP: Record<QuickRole, Record<string, string>> = {
  SUPER_ADMIN: {
    '1': 'list_companies',
    '2': 'switch_company',
    '3': 'generate_platform_report',
    '4': 'system_health',
  },
  AGENT: {
    '1': 'check_rent_status',
    '2': 'send_bulk_reminder',
    '3': 'generate_mckinsey_report',
    '4': 'log_maintenance',
    '5': 'check_vacancy',
  },
  TENANT: {
    '1': 'tenant_balance_inquiry',
    '2': 'request_receipt',
    '3': 'report_maintenance',
    '4': 'request_statement',
  },
  LANDLORD: {
    '1': 'collection_status',
    '2': 'request_report',
    '3': 'check_vacancy',
    '4': 'contact_agent',
  },
};

const greetableRegex =
  /^(hi|hello|habari|mambo|hey|jambo|menu|start|help|msaada|sasa|bonjour)/i;
const quickActionRegex = /^\d[\.?)\s]*$/;
const yesRegex = /^(yes|y|yeah|sure|ok|okay|ndio|dio|sawa|poa)$/i;
const noRegex = /^(no|n|nope|hapana|la)$/i;

const SESSION_TTL_SECONDS = 60 * 60; // 1 hour session cache

const resolveQuickRole = (context: any): QuickRole => {
  const role = (context?.role || context?.userRole || '').toUpperCase();
  if (role === UserRole.SUPER_ADMIN) return 'SUPER_ADMIN';
  if (role === UserRole.LANDLORD) return 'LANDLORD';
  if (role === UserRole.TENANT) return 'TENANT';
  return 'AGENT';
};

const renderActionMenu = (role: QuickRole, language: Lang, context: any) => {
  const name = context?.userName || context?.name || 'there';
  const template = GREETING_TEMPLATES[role][language];
  const payload = template(name, {
    unpaidCount: context?.unpaidCount || context?.metrics?.unpaidCount || 0,
    overdueCount: context?.overdueCount || context?.metrics?.overdueCount || 0,
    balanceDue: context?.balanceDue || 0,
    currentMonth: context?.currentMonth,
    portfolioName: context?.portfolioName || context?.companyName,
    collectionRate:
      context?.collectionRate || context?.metrics?.collectionRate || 0,
    vacantCount: context?.vacantCount || context?.metrics?.vacantCount || 0,
  });
  const actionLines = payload.actions
    .map((a) => `${a.key}. ${a.label}`)
    .join('\n');
  return [
    payload.greeting,
    payload.subtitle,
    '',
    actionLines,
    '',
    language === 'SW'
      ? '_Au andika swali lako moja kwa moja._'
      : '_Or type your question directly._',
  ].join('\n');
};

const getSessionKey = (context: any) => {
  return `ai_session:${getSessionUid(context)}`;
};

const loadSession = async (
  cacheManager: Cache | undefined,
  context: any,
): Promise<SessionState | null> => {
  if (!cacheManager) return null;
  const key = getSessionKey(context);
  const state = await cacheManager.get<SessionState>(key);
  return state || null;
};

const saveSession = async (
  cacheManager: Cache | undefined,
  context: any,
  state: SessionState,
) => {
  if (!cacheManager) return;
  const key = getSessionKey(context);
  const existing = await cacheManager.get<SessionState>(key);
  const merged = { ...existing, ...state };
  await cacheManager.set(key, merged, SESSION_TTL_SECONDS);
};

const routeQuickAction = (message: string, role: QuickRole): string | null => {
  const trimmed = message.trim();
  if (!quickActionRegex.test(trimmed)) return null;
  const key = trimmed.replace('.', '');
  return QUICK_ACTION_MAP[role]?.[key] || null;
};

const POST_ACTION_SUGGESTIONS: Record<
  string,
  (
    lang: Lang,
    ctx: any,
  ) => {
    text: string;
    nextAction: string;
    options?: Record<string, string>;
  } | null
> = {
  check_rent_status: (lang: Lang, ctx: any) => {
    const unpaid = ctx?.unpaidCount ?? ctx?.metrics?.unpaidCount ?? 0;
    if (unpaid <= 0) return null;
    const text =
      lang === 'SW'
        ? `Wapangaji ${unpaid} hawajalipa. Tuma vikumbusho sasa?
1. Ndiyo
2. Hapana`
        : `${unpaid} unpaid tenants. Send reminders now?
1. Yes
2. Not now`;
    return {
      text,
      nextAction: 'send_bulk_reminder',
      options: { '1': 'send_bulk_reminder', '2': 'CANCEL' },
    };
  },
  send_bulk_reminder: (lang: Lang, ctx: any) => {
    const sent = ctx?.sentCount ?? 0;
    const text =
      lang === 'SW'
        ? `✅ Vikumbusho ${sent || ''} vimetumwa. Tengeneze ripoti ya makusanyo sasa?
1. Ndiyo
2. Hapana`
        : `✅ ${sent || ''} reminders sent. Generate collection report now?
1. Yes
2. No`;
    return {
      text,
      nextAction: 'generate_mckinsey_report',
      options: { '1': 'generate_mckinsey_report', '2': 'CANCEL' },
    };
  },
  record_payment: (lang: Lang, ctx: any) => {
    const text =
      lang === 'SW'
        ? `Malipo yamesajiliwa. Tuma risiti sasa?
1. Ndiyo
2. Hapana`
        : `Payment recorded. Send a receipt now?
1. Yes
2. No`;
    return {
      text,
      nextAction: 'generate_receipt',
      options: { '1': 'generate_receipt', '2': 'CANCEL' },
    };
  },
};

const executeQuickAction = async (
  action: string,
  context: any,
  executeTool: (name: string, args: any, ctx: any) => Promise<any>,
  lang: Lang = 'EN',
) => {
  switch (action) {
    case 'list_companies':
      return executeTool('list_companies', {}, context);
    case 'switch_company':
      // Selection requires a companyId; list companies first so the menu router can capture a selection.
      return executeTool('list_companies', {}, context);
    case 'RETRY':
      return {
        success: true,
        data:
          lang === 'SW'
            ? 'Tafadhali jaribu tena ombi lako.'
            : 'Please try your request again.',
        action: 'retry',
      };
    case 'MAIN_MENU':
      return {
        success: true,
        data: renderActionMenu(resolveQuickRole(context), lang, context),
        action: 'menu',
      };
    case 'generate_platform_report':
      return executeTool(
        'generate_report_file',
        { scope: 'platform', format: 'pdf' },
        context,
      );
    case 'system_health':
      return executeTool('get_company_summary', {}, context);
    case 'check_rent_status':
      return executeTool('get_portfolio_arrears', {}, context);
    case 'send_bulk_reminder':
      return executeTool('send_rent_reminders', {}, context);
    case 'generate_mckinsey_report':
      return executeTool(
        'generate_report_file',
        { scope: 'portfolio', format: 'pdf' },
        context,
      );
    case 'generate_mckinsey_report_silent':
      return executeTool(
        'generate_report_file',
        { scope: 'portfolio', format: 'pdf' },
        context,
      );
    case 'log_maintenance':
      return executeTool('create_maintenance_request', {}, context);
    case 'check_vacancy':
      return executeTool('list_vacant_units', {}, context);
    case 'tenant_balance_inquiry':
      return executeTool(
        'list_invoices',
        { scope: 'self', status: 'OPEN' },
        context,
      );
    case 'request_receipt':
      return executeTool(
        'generate_receipt',
        { scope: 'last_payment' },
        context,
      );
    case 'report_maintenance':
      return executeTool('create_maintenance_request', {}, context);
    case 'request_statement':
      return executeTool(
        'generate_report_file',
        { scope: 'tenant_statement', format: 'pdf' },
        context,
      );
    case 'collection_status':
      return executeTool('get_portfolio_arrears', {}, context);
    case 'request_report':
      return executeTool(
        'generate_report_file',
        { scope: 'portfolio', format: 'pdf' },
        context,
      );
    case 'contact_agent':
      return executeTool('get_company_staff', { role: 'AGENT' }, context);
    case 'CANCEL':
      return null;
    default:
      return {
        success: false,
        data: null,
        error: `Invalid action: ${action}`,
        action,
      };
  }
};

export const tryDirectTool = async (
  message: string,
  context: any,
  prisma: any,
  executeTool: (name: string, args: any, ctx: any) => Promise<any>,
  language: string = 'en',
  cacheManager?: Cache,
) => {
  const lang = (language?.toUpperCase() || 'EN') as Lang;
  const text = normalizeText(message);
  const quickRole = resolveQuickRole(context);

  const session =
    (await loadSession(cacheManager, context)) ||
    ({ userId: context?.userId || 'anon' } as SessionState);

  // 0. Quick-action digits (1-5) — deterministic routing
  // PRIORITY: If we have a list awaiting selection, handle it first.
  const listIntents = ['list_companies', 'switch_company', 'search_companies'];
  const isDigit = quickActionRegex.test(message.trim());
  const shouldSkipHijack =
    isDigit && listIntents.includes(session.lastIntent || '');

  if (shouldSkipHijack && session.lastResults) {
    const index = parseInt(message.trim()) - 1;
    const result = session.lastResults[index];
    if (result) {
      if (result.type === 'company') {
        session.lastIntent = 'select_company';
        await saveSession(cacheManager, context, session);
        return await executeTool(
          'select_company',
          { companyId: result.id },
          context,
        );
      }
    }
  }

  // 0.5 YES/NO confirmation handler when a pending confirmation exists
  if (
    session.pendingConfirmation &&
    session.pendingConfirmation.expiresAt > Date.now()
  ) {
    const trimmed = message.trim();
    const numericKey = trimmed.replace('.', '');
    const optionAction = session.pendingConfirmation.options?.[numericKey];

    if (optionAction) {
      const followUp = await executeQuickAction(
        optionAction,
        context,
        executeTool,
        lang,
      );
      session.pendingConfirmation = undefined;
      await saveSession(cacheManager, context, session);
      if (optionAction === 'CANCEL')
        return {
          success: true,
          data: lang === 'SW' ? '🚫 Imebatilishwa.' : '🚫 Cancelled.',
          action: 'cancel',
        };
      if (followUp) return followUp;
      return {
        success: true,
        data: lang === 'SW' ? '✅ Imefanikiwa.' : '✅ Done.',
        action: optionAction,
      };
    }
    if (yesRegex.test(text)) {
      const followUp = await executeQuickAction(
        session.pendingConfirmation.action,
        context,
        executeTool,
        lang,
      );
      session.pendingConfirmation = undefined;
      await saveSession(cacheManager, context, session);
      if (followUp) return followUp;
      return lang === 'SW' ? '✅ Imefanikiwa.' : '✅ Done.';
    }
    if (noRegex.test(text)) {
      session.pendingConfirmation = undefined;
      await saveSession(cacheManager, context, session);
      return {
        success: true,
        data: lang === 'SW' ? '🚫 Imebatilishwa.' : '🚫 Cancelled.',
        action: 'cancel',
      };
    }
  }
  if (
    session.pendingConfirmation &&
    session.pendingConfirmation.expiresAt <= Date.now()
  ) {
    session.pendingConfirmation = undefined;
    await saveSession(cacheManager, context, session);
  }

  // 1. Stored menu actions (from previous renderActionMenu)
  // If we recently showed a menu, respect its options even if role isn't resolved
  const trimmedDigit = message.trim().replace(/[.?]/g, '');
  const storedMenuAction = session.lastActionMenu?.options?.[trimmedDigit];
  if (storedMenuAction) {
    const quickResult = await executeQuickAction(
      storedMenuAction,
      context,
      executeTool,
      lang,
    );

    // RELOAD session to catch updates from the tool (e.g. list_companies updates lastResults)
    const updatedSession =
      (await loadSession(cacheManager, context)) || session;
    updatedSession.lastIntent = storedMenuAction;
    await saveSession(cacheManager, context, updatedSession);

    if (quickResult) return quickResult;
  }

  const quickIntent = shouldSkipHijack
    ? null
    : routeQuickAction(message, quickRole);
  if (quickIntent) {
    const quickResult = await executeQuickAction(
      quickIntent,
      context,
      executeTool,
      lang,
    );
    session.lastIntent = quickIntent;

    // Post-action suggestion hook
    const suggestionContext =
      typeof quickResult === 'object' && quickResult !== null
        ? { ...context, ...quickResult }
        : context;
    const suggestion = POST_ACTION_SUGGESTIONS[quickIntent]?.(
      lang,
      suggestionContext,
    );
    if (suggestion) {
      session.pendingConfirmation = {
        action: suggestion.nextAction,
        context,
        expiresAt: Date.now() + 5 * 60 * 1000,
        options: suggestion.options,
      };
      await saveSession(cacheManager, context, session);
      if (quickResult) return quickResult;
      return { success: true, data: suggestion.text, action: quickIntent };
    }

    await saveSession(cacheManager, context, session);
    if (quickResult) return quickResult;
    // If we don't have a direct tool, fall through to the rest of the pipeline.
  }

  // 1. Greetings & Help → role-based action menu
  if (greetableRegex.test(text)) {
    const menu = renderActionMenu(quickRole, lang, context);
    session.lastActionMenu = {
      role: quickRole,
      options: QUICK_ACTION_MAP[quickRole],
    };
    await saveSession(cacheManager, context, session);
    return { success: true, data: menu, action: 'menu' };
  }
  if (/^(help|msaada|what can you do|how to use)/i.test(text)) {
    return {
      success: true,
      data: renderTemplate('help', lang, {}),
      action: 'help',
    };
  }

  // 2. Vacancy Counts / Vacant Units
  if (
    /^how many (units are )?vacant|^vacancies|^list vacant units/i.test(text)
  ) {
    return await executeTool('list_vacant_units', {}, context);
  }

  // 3. Company Summary
  if (
    /^company summary|^about (the |my )?company|^how is the business doing/i.test(
      text,
    )
  ) {
    if (!context.companyId) {
      return renderTemplate('company_selection_required', lang, {});
    }
    if ((context.role || context.userRole) === 'UNIDENTIFIED') {
      return {
        success: false,
        data: null,
        error: renderTemplate('unidentified_denial', lang, {}),
        action: 'get_company_summary',
      };
    }
    return await executeTool('get_company_summary', {}, context);
  }

  // 4. User Profile / Identity
  if (/^who am i|^my profile|^show my details/i.test(text)) {
    const companyInfo = context.companyId
      ? lang === 'EN'
        ? ` at company ID ${context.companyId}`
        : ` katika kampuni ID ${context.companyId}`
      : '';
    return {
      success: true,
      data: renderTemplate('profile_info', lang, {
        role: context.role,
        companyInfo,
        userId: context.userId,
      }),
      action: 'profile',
    };
  }

  // 5. Arrears / Collection Status
  if (
    /^who hasn't paid|^arrears|^collection status|^unpaid units/i.test(text)
  ) {
    if (!context.companyId) {
      return renderTemplate('company_selection_required', lang, {});
    }
    return await executeTool('get_portfolio_arrears', {}, context);
  }

  // 6. Payment Confirmation (Nimetuma / I've paid)
  const isQuestion = /[?]|(has|is|who|check|show|list)\b/i.test(text);
  const mpesaCodeRegex = /\b(?=[A-Z0-9]*\d)[A-Z0-9]{10}\b/;
  const mpesaMatch = message.toUpperCase().match(mpesaCodeRegex);
  
  // Only trigger proactive code request for tenants/landlords, 
  // and only if it doesn't look like a question.
  const canProactivelyRequest = !isQuestion && (quickRole === 'TENANT' || quickRole === 'LANDLORD');
  
  const hasPaymentReportSignal =
    /\bnimetuma\b|\bnimepay\b|\bi have paid\b|\bi've paid\b|\bmalipo yangu\b/i.test(
      text,
    );

  if (mpesaMatch) {
    const code = mpesaMatch[1];
    const payment = await prisma.payment.findFirst({
      where: { reference: code },
      include: { lease: { include: { unit: true, tenant: true } } },
    });

    if (payment) {
      const tenant = payment.lease.tenant;
      const unit = payment.lease.unit;
      return {
        success: true,
        data: renderTemplate('payment_confirmation_success', lang, {
          code,
          amount: payment.amount.toLocaleString(),
          unitNumber: unit?.unitNumber || 'N/A',
          date: payment.paidAt.toLocaleDateString(),
        }),
        action: 'payment_confirmation',
      };
    } else {
      return {
        success: true,
        data: renderTemplate('payment_confirmation_pending', lang, { code }),
        action: 'payment_confirmation',
      };
    }
  }

  if (canProactivelyRequest && hasPaymentReportSignal) {
    return {
      success: true,
      data: renderTemplate('payment_code_request', lang, {}),
      action: 'payment_code_request',
    };
  }

  return null;
};
