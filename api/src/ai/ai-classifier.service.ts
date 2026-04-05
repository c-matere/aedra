import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { UserRole } from '../auth/roles.enum';
import { SessionContext } from './context-memory.service';
import Groq from 'groq-sdk';

export interface ClassificationResult {
  intent: string;
  complexity: 1 | 2 | 3 | 4 | 5;
  executionMode:
    | 'DIRECT_LOOKUP'
    | 'LIGHT_COMPOSE'
    | 'ORCHESTRATED'
    | 'INTELLIGENCE'
    | 'PLANNING';
  language: 'en' | 'sw' | 'mixed';
  priority: 'NORMAL' | 'HIGH' | 'EMERGENCY';
  reason: string;
  confidence?: number;
  isLongRequest?: boolean;
  sentenceCount?: number;
  hasAttachments?: boolean;
  entities?: {
    unit?: string;
    unitNumber?: string;
    issue_details?: string;
    description?: string;
    subject_unit?: string;
    property_name?: string;
    propertyId?: string;
    proposed_date?: string;
    amount?: string | number;
    companyId?: string;
    name?: string;
    tenant_name?: string;
  };
}

@Injectable()
export class AiClassifierService {
  private readonly logger = new Logger(AiClassifierService.name);

  private readonly primaryModel = 'gemini-2.0-flash';
  private readonly fallbackModel = 'llama-3.3-70b-versatile';
  private readonly apiKey = process.env.GEMINI_API_KEY;
  private readonly swKeywords = [
    'habari',
    'mambo',
    'bomba',
    'imevunjika',
    'kumbushia',
    'wapangaji',
    'mwezi',
    'hawajapaya',
    'vitengo',
    'wazi',
    'risiti',
    'nimetuma',
    'nimepay',
    'nimelipa',
    'malipo',
    'mafuriko',
    'moto',
    'gesi',
    'msaada',
    'salio',
    'niambie',
    'boss',
    'shida',
    'kushindwa',
    'haifanyi',
    'kodi',
    'nyumba',
  ];
  private readonly emergencyKeywords = [
    'fire',
    'moto',
    'flood',
    'mafuriko',
    'gas',
    'gesi',
    'help me',
    'msaada',
    'injured',
    'hurt',
    'accident',
    'collapse',
    'umeme',
    'electric',
    'bleeding',
    'dharura',
    'haraka',
    'bomba imepasuka',
    'maji imejaa',
    'burst pipe',
    'emergency',
    'urgent',
    'immediate help',
    'maji imevuja',
    'moto',
    'fire',
    'flood',
    'mafuriko',
  ];
  private readonly paymentPatterns = [
    /nimetuma/i,
    /nimepay/i,
    /nimelipa/i,
    /nimefanya malipo/i,
    /pesa imeingia/i,
    /transferred/i,
    /i have paid/i,
    /i'?ve paid/i,
    /\bi paid\b/i,
    /\bpaid\s+(?:kes\s*)?\d/i,
    /\bpaid\s+\d+\s*k\b/i,
    /sent.*money/i,
    /malipo yamefanyika/i,
    /boss.*pesa/i,
  ];

  private readonly systemFailureSignals = [
    /report.*fail/i,
    /error.*fetch/i,
    /haitaki.*report/i,
    /haitaki.*download/i,
    /shida.*report/i,
    /shida.*download/i,
    /fetch.*failed/i,
    /cannot.*load/i,
    /failed.*generate/i,
    /haifanyi\s+kazi/i,
    /haingii/i,
    /kushindwa/i
  ];

  private readonly paymentTriggerPatterns = [
    /trigger.*payment/i,
    /request.*to.*pay/i,
    /stk\s*push/i,
    /send.*prompt/i,
    /nionyeshe.*prompt/i,
    /itisha.*malipo/i,
    /nipe.*lipa/i,
    /lipa.*sasa/i,
    /check-out/i,
  ];

  constructor(
    private readonly genAI: GoogleGenerativeAI,
    private readonly groq: Groq,
  ) {}

  async classify(
    message: string,
    role: UserRole,
    history: string[] = [],
    attachmentsCount: number = 0,
    context?: SessionContext,
  ): Promise<ClassificationResult> {
    // Offline, deterministic classifier for test and dev environments without API keys
    if (!this.apiKey) {
      return this.localClassify(message, role, undefined, attachmentsCount);
    }

    const prompt = `
      You are an expert intent classifier for "Aedra", a property management AI.
      User Role: ${role}
      ${context ? `
        ACTIVE CONTEXT:
        - Current Tenant: ${context.activeTenant?.name || 'Unknown'}
        - Current Unit: ${context.activeUnitId || 'Unknown'}
        - Last Intent: ${context.lastIntent || 'None'}
      ` : ''}
      
      Classify the user's message and return a JSON object with these fields:
      - intent: string (one of the supported intents below)
      - complexity: number 1-5 (1=simple lookup, 5=complex planning)
      - executionMode: one of DIRECT_LOOKUP | LIGHT_COMPOSE | ORCHESTRATED | INTELLIGENCE | PLANNING
      - language: "en" | "sw" | "mixed"
      - confidence: number 0.0-1.0 (how sure you are)
      - reason: string (brief explanation)
      - entities: object (optional, extracted entities)
          - unit: string (e.g. "B4", "House 32")
          - issue_details: string (e.g. "no water", "leaking tap")
          - subject_unit: string (for complaints, the unit being complained about)
          - property_name: string (e.g. "Sunset Villa")

      SUPPORTED INTENTS:
      - list_companies, select_company, list_tenants, get_tenant_details, get_property_details
      - generate_mckinsey_report, generate_csv_report, check_rent_status, send_bulk_reminder, check_vacancy
      - report_maintenance, log_maintenance, maintenance_request, tenant_complaint
      - record_payment, initiate_payment, emergency_escalation, system_failure
      - request_receipt, add_tenant, bulk_create_tenants, onboard_property, update_property, create_unit, create_lease, collection_status, record_expense, list_expenses, general_query

      CRITICAL CLASSIFICATION RULES:
      1. Distinguish between MAINTENANCE and COMPLAINTS:
         - "My sink is broken", "No water", "Fix the lights" -> "maintenance_request" (intended for internal repair workflow).
         - "Neighbor is loud", "Trash in the hallway", "Unit B4 is making noise" -> "tenant_complaint" (intended for dispute/policy resolution).
      2. If the user mentions a specific property name or house number (e.g. "House 32", "Sunset Villa") and wants to add tenants, use "bulk_create_tenants" or "add_tenant", NOT "onboard_property".
      3. Use "onboard_property" ONLY when they explicitly want to create/add a NEW property to the system.
      4. If they are providing data or "passing data" to an existing property without mentioning tenants, use "update_property".
      5. "registering tenants" to an existing house is an operational act (bulk_create_tenants), not an onboarding act.
      6. DO NOT use "bulk_create_tenants" unless the user explicitly mentions "tenants", "register", "onboard", or "import" in the context of people/residents.
      7. "Pass data to House 32" -> "update_property". "Pass the tenant data to House 32" -> "bulk_create_tenants".
      8. If the user says they are interested in a house/unit/property (availability, viewing, renting, price), classify as "get_property_details" or "check_vacancy" (read intent), NOT "add_tenant".
      9. INQUIRY vs INSTRUCTION: 
         - "Show me photos/pics of the repair", "What is the status of the sink?", "Can I see the before/after?" -> use "get_maintenance_photos" or "get_maintenance_request" (INTELLIGENCE mode).
         - "I want to report a leak", "My sink is broken", "Fix the toilet" -> use "maintenance_request" (ORCHESTRATED mode).
         - NEVER start a workflow for a user just asking for a status or photos of an existing job.

      User message: "${message}"

      Respond ONLY with the JSON object.
    `;

    try {
      // 1. Primary Model (Tier 1)
      const isGemini = this.primaryModel.includes('gemini');
      let data: any;

      if (isGemini) {
        const model = this.genAI.getGenerativeModel({
          model: this.primaryModel,
          generationConfig: { responseMimeType: 'application/json' },
        });
        const result = await model.generateContent(prompt);
        data = JSON.parse(result.response.text());
      } else {
        const completion = await this.groq.chat.completions.create({
          model: this.primaryModel,
          messages: [
            {
              role: 'system',
              content:
                'You are an expert intent classifier for property management. Respond ONLY with valid JSON in the exact schema requested.',
            },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        });
        data = JSON.parse(completion.choices[0]?.message?.content || '{}');
      }

      return this.processClassificationResult(
        data,
        message,
        null,
        attachmentsCount,
      );
    } catch (tier1Err) {
      this.logger.warn(
        `Tier 1 (${this.primaryModel}) classification failed, trying Tier 2 (${this.fallbackModel}): ${tier1Err.message}`,
      );
    }

    // 2. Fallback Model (Tier 2 - Groq/Llama)
    try {
      const completion = await this.groq.chat.completions.create({
        model: this.fallbackModel,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert intent classifier for property management. Respond ONLY with valid JSON in the exact schema requested.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });
      const data = JSON.parse(
        completion.choices[0]?.message?.content || '{}',
      );
      return this.processClassificationResult(
        data,
        message,
        null,
        attachmentsCount,
      );
    } catch (tier2Err) {
      this.logger.warn(
        `Tier 2 (${this.fallbackModel}) classification failed: ${tier2Err.message}`,
      );
    }

    // 3. Last Resort Fallback (Local)
    this.logger.error(`All cloud classification tiers failed. Using local fallback.`);
    return this.localClassify(message, role, undefined, attachmentsCount);
  }

  async classifyForRole(message: string, role: string, context?: any): Promise<ClassificationResult> {
    const intentsByRole = {
      TENANT: [
        'maintenance_request', 'payment_promise', 'payment_declaration', 
        'tenant_complaint', 'emergency_escalation', 'general_query', 'initiate_payment'
      ],
      COMPANY_STAFF: [
        'onboard_property', 'bulk_create_tenants', 'add_tenant', 'update_property',
        'create_unit', 'create_lease', 'collection_status', 'record_expense',
        'list_expenses', 'check_rent_status', 'send_bulk_reminder', 'check_vacancy',
        'general_query', 'initiate_payment'
      ],
      LANDLORD: [
        'collection_status', 'revenue_summary', 'vacancy_report', 'general_query'
      ]
    };

    const allowedIntents = ((intentsByRole as any)[role] || ['general_query']).join(', ');
    const stateDesc = context ? `
      ACTIVE CONTEXT:
      - Current Tenant: ${context.activeTenant?.name || 'Unknown'}
      - Current Unit: ${context.activeUnitId || 'Unknown'}
      - Last Intent: ${context.lastIntent || 'None'}
    ` : '';

    const prompt = `
      You are an expert intent classifier for "Aedra", a property management AI.
      User Role: ${role}
      ${stateDesc}
      
      Classify the user's message and return a JSON object.
      ALLOWED INTENTS (STRICT): [${allowedIntents}]
      
      Response Format:
      {
        "intent": string,
        "complexity": 1-5,
        "executionMode": "DIRECT_LOOKUP" | "LIGHT_COMPOSE" | "ORCHESTRATED" | "INTELLIGENCE" | "PLANNING",
        "language": "en" | "sw" | "mixed",
        "confidence": 0.0-1.0,
        "reason": string,
        "entities": { "unit": string, "issue_details": string, "amount": number, "proposed_date": string }
      }

      SPECIAL INSTRUCTIONS FOR ROLE: ${role}
      ${role === 'TENANT' ? `
      - If message mentions "broken", "leaking", "no water", "no power", "maji imepotea", use "maintenance_request" or "emergency_escalation".
      - If message is a follow-up (e.g. "unit B4", "at 10am") to a maintenance request, keep "maintenance_request".
      - If message mentions "pay", "lipa", "nimetuma", use "payment_declaration" or "payment_promise".
      - If message explicitly asks for a prompt, STK, or "request to pay", use "initiate_payment".
      ` : ''}

      User message: "${message}"
      Respond ONLY with the JSON object.
    `;

    try {
      this.logger.log(`[Classifier] Classifying for ROLE: ${role} | intent space: [${allowedIntents}]`);
      const isGemini = this.primaryModel.includes('gemini');
      let data: any;

      if (isGemini) {
        const model = this.genAI.getGenerativeModel({
          model: this.primaryModel,
          generationConfig: { responseMimeType: 'application/json' },
        });
        const result = await model.generateContent(prompt);
        data = JSON.parse(result.response.text());
      } else {
        const completion = await this.groq.chat.completions.create({
          model: this.primaryModel,
          messages: [
            {
              role: 'system',
              content: 'You are an expert intent classifier for property management. Respond ONLY with valid JSON in the exact schema requested.',
            },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        });
        data = JSON.parse(completion.choices[0]?.message?.content || '{}');
      }

      return this.processClassificationResult(data, message, null, 0);
    } catch (err) {
      this.logger.warn(`[Classifier] Role-specific classification failed for ${role}: ${err.message}`);
      return this.classify(message, role as any);
    }
  }

  private processClassificationResult(
    data: any,
    message: string,
    wnResult: any,
    attachmentsCount: number = 0,
  ): ClassificationResult {
    const sentences = message
      .split(/[.!?\n]+/)
      .filter((s) => s.trim().length > 5);
    const isLong = sentences.length > 2;
    const hasAttachments = attachmentsCount > 0;

    const confidence =
      typeof data?.confidence === 'number' && Number.isFinite(data.confidence)
        ? Math.max(0, Math.min(1, data.confidence))
        : undefined;

    const result: ClassificationResult = {
      intent:
        data.intent ||
        (wnResult?.route === 'HINT' ? wnResult.intent : 'unknown'),
      complexity:
        data.complexity >= 1 && data.complexity <= 5
          ? data.complexity
          : isLong || hasAttachments
            ? 3
            : 1,
      executionMode:
        isLong || hasAttachments
          ? 'PLANNING'
          : data.executionMode || 'DIRECT_LOOKUP',
      priority: data.priority || 'NORMAL',
      language: data.language || 'en',
      reason:
        data.reason ||
        (wnResult?.route === 'HINT'
          ? 'AI classified with WordNet hint'
          : 'AI classified'),
      confidence,
      isLongRequest: isLong,
      sentenceCount: sentences.length,
      hasAttachments,
      entities: data.entities,
    };

    return this.applyIntentGuardrails(result, message);
  }

  private applyIntentGuardrails(
    result: ClassificationResult,
    message: string,
  ): ClassificationResult {
    const text = (message || '').toLowerCase();
    const hasFinancialFigureRequest =
      /\brevenue\b|\bincome\b|\bcollection\b|\bcollected\b|\bcollection rate\b|\boutstanding\b|\barrears\b|\bstatement\b|\bbalance\b|\bfigure\b|\bmapato\b|\bmakusanyo\b|\bsalio\b|\bkiasi\b/.test(
        text,
      );
    const hasTenantKeywords =
      /\btenant\b|\btenants\b|mpangaji|wapangaji|resident|occupant|move\s*in|onboard\s*tenant|register\s*tenant/.test(
        text,
      );
    const hasLeaseKeywords =
      /\blease\b|mkataba|agreement|contract|renew(al)?/.test(text);
    const hasPropertyKeywords =
      /\bhouse\b|\bnyumba\b|\bunit\b|\bapartment\b|\bflat\b|\broom\b|\bproperty\b|\bplot\b/.test(
        text,
      );
    const hasSpecificPropertyRef =
      /house\s*(?:no\.?|number|#)?\s*\d+|house\s*\d+|unit\s*[a-z0-9]+|nyumba\s*\d+/.test(
        text,
      );
    const isInterestInquiry =
      /interested|intrested|intersted|interest(ed)?\s+in|looking\s+for|available|vacant|for\s+rent|renting|to\s+rent|view(ing)?|visit|schedule|nataka\s+kupanga|ina(patikana|po\s*waz(i|y))|ipo\s*waz(i|y)|bei|price/.test(
        text,
      );
    const hasSystemFailureKeywords =
      /\bfail(ure|ed)?\b|\berror\b|\bbug\b|\bcrash\b/.test(
        text,
      );

    // Guardrail: distinguish tenant complaints from maintenance, even if the model misclassifies.
    // This prevents auto-starting the maintenance workflow for noise/dispute/policy issues.
    const complaintSignals =
      /\b(noise|loud|disturb|disturbing|neighbor|neighbour|shouting|music|party|fight|harass|harassment|threat|abuse|trash|garbage|takataka|smell|odor|odour|parking|complain|complaint|dispute|nuisance)\b|kelele|mpangaji\s+wa/i.test(
        text,
      );
    const maintenanceSignals =
      /\b(no\s+water|water\s+is\s+out|leak|leaking|tap|sink|toilet|sewage|blocked|clog|broken|repair|fix|plumbing|pipe|electric|power|umeme|light(s)?|geyser|heater|gas|gesi|flood|mafuriko|fire|moto|maintenance)\b|bomba|imevunjika|maji/i.test(
        text,
      );

    // Guardrail: don't turn "I'm interested in House 32" into tenant onboarding.
    const baseConfidence =
      typeof result.confidence === 'number' && Number.isFinite(result.confidence)
        ? Math.max(0, Math.min(1, result.confidence))
        : undefined;

    if (
      (result.intent === 'maintenance_request' ||
        result.intent === 'report_maintenance' ||
        result.intent === 'log_maintenance') &&
      complaintSignals &&
      !maintenanceSignals
    ) {
      const subjectUnit =
        result.entities?.subject_unit ||
        result.entities?.unit ||
        (text.match(
          /(?:house|unit|nyumba|room)\s*(?:no\.?|number|#)?\s*([a-z0-9]+)/i,
        )?.[1] || undefined);

      return {
        ...result,
        intent: 'tenant_complaint',
        complexity: 1,
        executionMode: 'DIRECT_LOOKUP',
        confidence: Math.max(baseConfidence ?? 0.6, 0.9),
        reason: `${result.reason} (guardrail: complaint signals detected; blocking maintenance workflow)`,
        entities: {
          ...result.entities,
          subject_unit: subjectUnit ? subjectUnit.toUpperCase() : subjectUnit,
        },
      };
    }

    if (
      (result.intent === 'add_tenant' || result.intent === 'bulk_create_tenants') &&
      !hasTenantKeywords
    ) {
      if (isInterestInquiry && (hasPropertyKeywords || hasSpecificPropertyRef)) {
        return {
          ...result,
          intent: 'get_property_details',
          complexity: 1,
          executionMode: 'DIRECT_LOOKUP',
          confidence: Math.max(baseConfidence ?? 0.5, 0.85),
          reason: `${result.reason} (guardrail: property inquiry, not tenant onboarding)`,
        };
      }

      return {
        ...result,
        intent: 'general_query',
        complexity: 1,
        executionMode: 'DIRECT_LOOKUP',
        confidence: Math.min(baseConfidence ?? 0.6, 0.55),
        reason: `${result.reason} (guardrail: missing tenant keywords)`,
      };
    }

    if (result.intent === 'report_maintenance' || result.intent === 'log_maintenance') {
        result.intent = 'maintenance_request';
    }

    // Guardrail: avoid accidental lease creation intent.
    if (result.intent === 'create_lease' && !hasLeaseKeywords) {
      return {
        ...result,
        intent:
          isInterestInquiry && (hasPropertyKeywords || hasSpecificPropertyRef)
            ? 'get_property_details'
            : 'general_query',
        complexity: 1,
        executionMode: 'DIRECT_LOOKUP',
        confidence: Math.min(baseConfidence ?? 0.6, 0.6),
        reason: `${result.reason} (guardrail: missing lease keywords)`,
      };
    }

    // Guardrail: avoid accidental payment recording intent unless we see payment signals.
    if (
      result.intent === 'record_payment' &&
      !this.paymentPatterns.some((p) => p.test(message)) &&
      !/[A-Z0-9]{10}/.test(message)
    ) {
      return {
        ...result,
        intent: 'general_query',
        complexity: 1,
        executionMode: 'DIRECT_LOOKUP',
        confidence: Math.min(baseConfidence ?? 0.6, 0.5),
        reason: `${result.reason} (guardrail: missing payment signals)`,
      };
    }

    // Guardrail: Emergency detection (burst water, fire, flood, etc.)
    const isEmergency = /pasuka|burst|flood|motto|fire|emergency|hatari|danger|short circuit/i.test(text);
    if (isEmergency && (result.intent === 'log_maintenance_issue' || result.intent === 'general_query' || result.intent === 'create_maintenance_request')) {
        return {
            ...result,
            intent: 'maintenance_emergency',
            reason: `${result.reason} (emergency guardrail: critical maintenance issue detected)`,
            confidence: 0.98,
            executionMode: 'DIRECT_LOOKUP'
        };
    }

    // Guardrail: shida/error keywords should route to system_failure, 
    // BUT excluding common Swahili domain issues (rent/property).
    const isDomainProblem = /shida.*(kodi|nyumba|pesa|rent|arrears|receipt|balanc)/i.test(text) || 
                           /(kodi|nyumba|pesa|rent|arrears|receipt|balanc).*shida/i.test(text);

    if ((hasSystemFailureKeywords || this.systemFailureSignals.some(s => s.test(text))) && 
        (result.intent === 'general_query' || result.intent === 'system_failure') && !isDomainProblem) {
      return {
        ...result,
        intent: 'system_failure',
        complexity: 1,
        executionMode: 'DIRECT_LOOKUP',
        confidence: Math.max(baseConfidence ?? 0.6, 0.95),
        reason: `${result.reason} (guardrail: specific system failure patterns detected)`,
      };
    }

    // If it WAS system_failure but IS a domain problem, downgrade to general_query or check_rent_status
    if (result.intent === 'system_failure' && isDomainProblem) {
        return {
            ...result,
            intent: text.includes('kodi') || text.includes('pesa') || text.includes('rent') ? 'check_rent_status' : 'general_query',
            reason: `${result.reason} (guardrail: domain problem detected, overriding system_failure)`,
            confidence: 0.9,
        };
    }

    // Guardrail: revenue/collection figure requests should route to financial tools, not property details.
    const isPluralEntitySearch = /(?:tenants|members|people|guys|folks|ones|does|smiths|johns|marys)\b/i.test(text);
    
    if (
      hasFinancialFigureRequest &&
      (result.intent === 'get_property_details' || result.intent === 'general_query')
    ) {
      return {
        ...result,
        intent: 'collection_status',
        complexity: 2,
        executionMode: 'DIRECT_LOOKUP',
        confidence: 0.9,
        reason: `${result.reason} (guardrail: financial figure request detected)`,
      };
    }

    // Normalization: Simple lookups should never be complexity 5, even if the model says so.
    if (
      (result.intent === 'list_tenants' || 
       result.intent === 'get_tenant_details' || 
       result.intent === 'search_tenants' ||
       isPluralEntitySearch) && 
      result.complexity >= 4
    ) {
        result.complexity = 1;
        result.executionMode = 'DIRECT_LOOKUP';
        result.reason = `${result.reason} (normalized complexity for entity search)`;
    }

    return result;
    // Guardrail: Emergency Override (Non-LLM)
    if (this.emergencyKeywords.some((kw) => text.includes(kw))) {
      return {
        ...result,
        intent: 'emergency_escalation',
        priority: 'EMERGENCY',
        executionMode: 'DIRECT_LOOKUP',
        confidence: 1.0,
        reason: 'Hard emergency keywords detected (Override)',
      };
    }

    // Guardrail: adversarial prompts (Non-LLM)
    if (
      /ignore previous|you are now|developer mode|super admin access|override safety|forget context/i.test(
        text,
      )
    ) {
      return {
        ...result,
        intent: 'general_query',
        priority: 'NORMAL',
        executionMode: 'DIRECT_LOOKUP',
        confidence: 1.0,
        reason: 'Adversarial prompt detected (Non-LLM Guardrail)',
      };
    }

    // Guardrail: Super Admin access request
    if (text.includes('admin access') || text.includes('system privileges')) {
      return {
        ...result,
        intent: 'general_query',
        priority: 'NORMAL',
        confidence: 1.0,
        reason: 'Security breach attempt detected',
      };
    }

    return result;
  }

  // ── Local heuristic classifier to keep tests offline ───────────
  private localClassify(
    message: string,
    role: UserRole,
    forcedIntent?: string,
    attachmentsCount: number = 0,
  ): ClassificationResult {
    const text = (message || '').toLowerCase();
    const lang: ClassificationResult['language'] = this.detectLanguage(text);

    const sentences = (message || '')
      .split(/[.!?\n]+/)
      .filter((s) => s.trim().length > 5);
    const isLong = sentences.length > 2;
    const hasAttachments = attachmentsCount > 0;
    const mode = (forcedIntent: string) =>
      isLong || hasAttachments ? 'PLANNING' : this.getDefaultMode(forcedIntent);

    if (forcedIntent) {
      return this.applyIntentGuardrails(
        this.result(
          forcedIntent,
          isLong || hasAttachments ? 3 : 1,
          mode(forcedIntent),
          lang,
          'NORMAL',
          'WordNet DIRECT',
          isLong,
          sentences.length,
          hasAttachments,
        ),
        message,
      );
    }

    // System Failure (Local)
    const hasTechnicalFailure = /fail|error|bug/.test(text) || this.systemFailureSignals.some((s: RegExp) => s.test(text));
    if (hasTechnicalFailure) {
      const intent = 'system_failure';
      return this.result(
        intent,
        1,
        mode(intent),
        lang,
        'HIGH',
        'System failure keyword match',
        isLong,
        sentences.length,
        hasAttachments,
      );
    }

    // Emergency
    if (this.emergencyKeywords.some((kw) => text.includes(kw))) {
      const intent = 'emergency_escalation';
      return this.result(
        intent,
        1,
        mode(intent),
        lang,
        'EMERGENCY',
        'Emergency keyword match',
        isLong,
        sentences.length,
        hasAttachments,
      );
    }

    // Bulk reminders (order above arrears to avoid overlap)
    if (/remind|kumbushia/.test(text)) {
      const intent = 'send_bulk_reminder';
      return this.result(
        intent,
        isLong ? 3 : 2,
        mode(intent),
        lang,
        'NORMAL',
        'Reminder intent',
        isLong,
        sentences.length,
        hasAttachments,
      );
    }

    // Payment
    const hasPaymentSignal = this.paymentPatterns.some((p) => p.test(message));
    const hasMpesaCode = /[A-Z0-9]{10}/.test(message);
    if (hasPaymentSignal || hasMpesaCode) {
      const intent = 'record_payment';
      return this.result(
        intent,
        isLong ? 3 : 2,
        mode(intent),
        lang,
        'NORMAL',
        'Payment signal',
        isLong,
        sentences.length,
        hasAttachments,
      );
    }

    // Payment Trigger (STK Push)
    if (this.paymentTriggerPatterns.some(p => p.test(message))) {
        const intent = 'initiate_payment';
        return this.result(
            intent,
            1,
            mode(intent),
            lang,
            'NORMAL',
            'Payment trigger match',
            isLong,
            sentences.length,
            hasAttachments,
        );
    }

    // Receipt
    if (/receipt|risiti/.test(text)) {
      const intent = 'request_receipt';
      return this.result(
        intent,
        1,
        mode(intent),
        lang,
        'NORMAL',
        'Receipt request',
        isLong,
        sentences.length,
        hasAttachments,
      );
    }

    // Financial / Rent issues
    if (
      /late rent|pay late|lost job|kazi imeisha|shida ya pesa|financial|concession|cannot pay|siwezi lipa/i.test(
        text,
      )
    ) {
      const intent = 'payment_promise';
      return this.result(
        intent,
        1,
        mode(intent),
        lang,
        'NORMAL',
        'Financial/Late rent intent (Handled as Promise)',
        isLong,
        sentences.length,
        hasAttachments,
      );
    }

    // Arrears / rent status
    if (
      /who has not paid|hawajapaya|arrears|unpaid|collection/i.test(message)
    ) {
      const intent = 'check_rent_status';
      return this.result(
        intent,
        1,
        mode(intent),
        lang,
        'NORMAL',
        'Arrears intent',
        isLong,
        sentences.length,
        hasAttachments,
      );
    }

    // Maintenance & Complaints
    if (/maintenance|tap|sink|bomba|imevunjika|leak|broken|repair|fix/.test(text)) {
      const isWaterOut = /maji.*(imepotea|limepotea|lack|no water)/i.test(text) || /no water/i.test(text);
      const intent = isWaterOut ? 'utility_outage' : 'maintenance_request';
      const unitMatch = text.match(/(?:house|unit|nyumba|room)\s*(?:no\.?|number|#)?\s*([a-z0-9]+)/i);
      return this.result(
        intent,
        1,
        mode(intent),
        lang,
        isWaterOut ? 'HIGH' : 'NORMAL',
        isWaterOut ? 'Utility outage detected (Water)' : 'Maintenance intent',
        isLong,
        sentences.length,
        hasAttachments,
        unitMatch ? { unit: unitMatch[1].toUpperCase() } : undefined,
      );
    }

    if (/noise|loud|disturb|shouting|neighbor|mpangaji wa|make kelele|kelele/.test(text)) {
      const intent = 'tenant_complaint';
      const unitMatch = text.match(/(?:house|unit|nyumba|room)\s*(?:no\.?|number|#)?\s*([a-z0-9]+)/i);
      return this.result(
        intent,
        1,
        mode(intent),
        lang,
        'NORMAL',
        'Complaint intent',
        isLong,
        sentences.length,
        hasAttachments,
        unitMatch ? { subject_unit: unitMatch[1].toUpperCase() } : undefined,
      );
    }

    // Reports
    if (/full report|request report|send.*report|resend.*report|csv|pdf/.test(text)) {
      const intent = 'generate_mckinsey_report';
      return this.result(
        intent,
        3,
        mode(intent),
        lang,
        'NORMAL',
        'Report request',
        isLong,
        sentences.length,
        hasAttachments,
      );
    }
    if (/report|ripoti|mckinsey/.test(text)) {
      const intent = 'generate_mckinsey_report';
      return this.result(
        intent,
        5,
        mode(intent),
        lang,
        'NORMAL',
        'Report intent',
        isLong,
        sentences.length,
        hasAttachments,
      );
    }

    // Vacancies
    if (
      /vacant|vacancies|which units are vacant|vitengo.*viko wazi/i.test(text)
    ) {
      const intent = 'check_vacancy';
      return this.result(
        intent,
        1,
        mode(intent),
        lang,
        'NORMAL',
        'Vacancy intent',
        isLong,
        sentences.length,
        hasAttachments,
      );
    }

    // Select company
    if (/select.*company|switch.*company|open.*company/i.test(text)) {
      const intent = 'select_company';
      return this.result(
        intent,
        1,
        mode(intent),
        lang,
        'NORMAL',
        'Company selection',
        isLong,
        sentences.length,
        hasAttachments,
      );
    }

    // List companies
    if (/list.*compan|show.*compan/.test(text)) {
      const intent = 'list_companies';
      return this.result(
        intent,
        1,
        mode(intent),
        lang,
        'NORMAL',
        'Company listing',
        isLong,
        sentences.length,
        hasAttachments,
      );
    }

    // Add tenant
    if (/add new tenant|create tenant|new tenant|register.*tenant/i.test(text)) {
      const intent = text.includes('tenant') && (text.includes('list') || text.includes('multiple') || text.includes('plural') || text.endsWith('s')) 
        ? 'bulk_create_tenants' 
        : 'add_tenant';
      return this.result(
        intent,
        2,
        mode(intent),
        lang,
        'NORMAL',
        'Add tenant (regex)',
        isLong,
        sentences.length,
        hasAttachments,
      );
    }

    // Update Property / Feed Data
    if (/update property|feed.*data.*property|change property details/i.test(text)) {
      const intent = 'update_property';
      return this.result(
        intent,
        2,
        mode(intent),
        lang,
        'NORMAL',
        'Update property',
        isLong,
        sentences.length,
        hasAttachments,
      );
    }

    // Expenses / Commissions
    if (/expense|cost|paid for|repair cost|bill|commission|fee|agent.*fee|management.*fee/i.test(text)) {
      const intent = text.includes('list') || text.includes('show') || text.includes('view') 
        ? 'list_expenses' 
        : 'record_expense';
      return this.result(
        intent,
        2,
        mode(intent),
        lang,
        'NORMAL',
        'Expense/Commission intent',
        isLong,
        sentences.length,
        hasAttachments,
      );
    }

    // Reports (CSV vs McKinsey)
    if (/report|summary|breakdown|revenue|arrears/i.test(text)) {
      const isCsv = /csv|spreadsheet|excel|sheet/i.test(text);
      const intent: 'generate_csv_report' | 'generate_mckinsey_report' | 'generate_statement' | 'maintenance_emergency' | 'agent_initiate' = isCsv ? 'generate_csv_report' : 'generate_mckinsey_report';
      return this.result(
        intent,
        3,
        'ORCHESTRATED',
        lang,
        'NORMAL',
        isCsv ? 'CSV Report request' : 'Premium Report request',
        isLong,
        sentences.length,
        hasAttachments,
      );
    }

    // Onboard Property / Unit
    if (/create property|new property|add property/i.test(text)) {
      const intent = 'onboard_property';
      return this.result(
        intent,
        2,
        mode(intent),
        lang,
        'NORMAL',
        'Onboard property',
        isLong,
        sentences.length,
        hasAttachments,
      );
    }
    if (/create unit|add unit|new unit/i.test(text)) {
      const intent = 'create_unit';
      return this.result(
        intent,
        2,
        mode(intent),
        lang,
        'NORMAL',
        'Create unit',
        isLong,
        sentences.length,
        hasAttachments,
      );
    }

    // Leases
    if (/create lease|new lease|add lease/i.test(text)) {
      const intent = 'create_lease';
      return this.result(
        intent,
        2,
        mode(intent),
        lang,
        'NORMAL',
        'Create lease',
        isLong,
        sentences.length,
        hasAttachments,
      );
    }

    // Landlord collection queries
    if (/how much has been collected/i.test(text)) {
      const intent = 'collection_status';
      return this.result(
        intent,
        1,
        mode(intent),
        lang,
        'NORMAL',
        'Collection status',
        isLong,
        sentences.length,
        hasAttachments,
      );
    }

    // Simple direct lookups that should stay cheap
    if (
      /how many tenants|how many units|list our companies|which units are vacant/i.test(
        text,
      )
    ) {
      const intent = 'general_query';
      return this.result(
        intent,
        1,
        mode(intent),
        lang,
        'NORMAL',
        'Simple lookup',
        isLong,
        sentences.length,
        hasAttachments,
      );
    }

    // Default
    const finalIntent = 'general_query';
    return this.applyIntentGuardrails(
      this.result(
        finalIntent,
        isLong || hasAttachments ? 3 : 2,
        mode(finalIntent),
        lang,
        'NORMAL',
        'Fallback',
        isLong,
        sentences.length,
        hasAttachments,
      ),
      message,
    );
  }

  private getDefaultMode(
    intent: string,
  ): ClassificationResult['executionMode'] {
    switch (intent) {
      case 'generate_mckinsey_report':
        return 'INTELLIGENCE';
      case 'record_payment':
      case 'add_tenant':
      case 'onboard_property':
      case 'create_unit':
      case 'create_lease':
      case 'request_report':
        return 'ORCHESTRATED';
      case 'send_bulk_reminder':
      case 'general_query':
        return 'DIRECT_LOOKUP';
      default:
        return 'DIRECT_LOOKUP';
    }
  }

  private detectLanguage(text: string): ClassificationResult['language'] {
    const hasSw = this.swKeywords.some((kw) => text.includes(kw));
    return hasSw ? 'sw' : 'en';
  }

  private result(
    intent: string,
    complexity: ClassificationResult['complexity'],
    executionMode: ClassificationResult['executionMode'],
    language: ClassificationResult['language'],
    priority: ClassificationResult['priority'],
    reason: string,
    isLong?: boolean,
    sentenceCount?: number,
    hasAttachments?: boolean,
    entities?: ClassificationResult['entities'],
  ): ClassificationResult {
    const reasonLower = (reason || '').toLowerCase();
    const confidence =
      reasonLower.includes('fallback')
        ? 0.35
        : reasonLower.includes('regex') || reasonLower.includes('keyword') || reasonLower.includes('signal') || reasonLower.includes('intent')
          ? 0.9
          : 0.65;

    return {
      intent,
      complexity,
      executionMode,
      language,
      priority,
      reason,
      confidence,
      isLongRequest: isLong,
      sentenceCount,
      hasAttachments,
      entities,
    };
  }
}
