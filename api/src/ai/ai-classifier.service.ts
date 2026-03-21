import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { UserRole } from '../auth/roles.enum';
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
  reason: string;
  isLongRequest?: boolean;
  sentenceCount?: number;
  hasAttachments?: boolean;
}

@Injectable()
export class AiClassifierService {
  private readonly logger = new Logger(AiClassifierService.name);
  private genAI: GoogleGenerativeAI;

  private readonly modelName = 'gemini-2.5-flash'; // Fallback model
  private readonly groqModel = 'llama-3.1-8b-instant'; // Tier 1 model
  private readonly apiKey: string;
  private groq: Groq;
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
  ];
  private readonly paymentPatterns = [
    /nimetuma/i,
    /nimepay/i,
    /nimelipa/i,
    /nimefanya malipo/i,
    /pesa imeingia/i,
    /transferred/i,
    /i have paid/i,
    /sent.*money/i,
    /malipo yamefanyika/i,
    /boss.*pesa/i,
  ];

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'dummy-key' });
  }

  async classify(
    message: string,
    role: UserRole,
    history: string[] = [],
    attachmentsCount: number = 0,
  ): Promise<ClassificationResult> {
    // Offline, deterministic classifier for test and dev environments without API keys
    if (!this.apiKey) {
      return this.localClassify(message, role, undefined, attachmentsCount);
    }

    const prompt = `
      You are an expert intent classifier for "Aedra", a property management AI.
      User Role: ${role}
      
      Classify the user's message and return a JSON object with these fields:
      - intent: string (one of the supported intents below)
      - complexity: number 1-5 (1=simple lookup, 5=complex planning)
      - executionMode: one of DIRECT_LOOKUP | LIGHT_COMPOSE | ORCHESTRATED | INTELLIGENCE | PLANNING
      - language: "en" | "sw" | "mixed"
      - reason: string (brief explanation)

      SUPPORTED INTENTS:
      - list_companies, select_company, list_tenants, get_tenant_details, get_property_details
      - generate_mckinsey_report, check_rent_status, send_bulk_reminder, check_vacancy
      - report_maintenance, log_maintenance, record_payment, emergency_escalation
      - request_receipt, add_tenant, bulk_create_tenants, onboard_property, update_property, create_unit, create_lease, collection_status, general_query

      CRITICAL CLASSIFICATION RULES:
      1. If the user mentions a specific property name or house number (e.g. "House 32", "Sunset Villa") and wants to add tenants, use "bulk_create_tenants" or "add_tenant", NOT "onboard_property".
      2. Use "onboard_property" ONLY when they explicitly want to create/add a NEW property to the system.
      3. If they are providing data or "passing data" to an existing property without mentioning tenants, use "update_property".
      4. "registering tenants" to an existing house is an operational act (bulk_create_tenants), not an onboarding act.
      5. DO NOT use "bulk_create_tenants" unless the user explicitly mentions "tenants", "register", "onboard", or "import" in the context of people/residents.
      6. "Pass data to House 32" -> "update_property". "Pass the tenant data to House 32" -> "bulk_create_tenants".

      User message: "${message}"

      Respond ONLY with the JSON object.
    `;

    try {
      // 2. Groq Tier 1 (Primary)
      try {
      const completion = await this.groq.chat.completions.create({
          model: this.groqModel,
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
      } catch (groqErr) {
        this.logger.warn(
          `Groq classification failed, falling back to Gemini: ${groqErr.message}`,
        );
      }

      // 3. Gemini Fallback
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
        generationConfig: { responseMimeType: 'application/json' },
      });

      const result = await model.generateContent(prompt);
      const data = JSON.parse(result.response.text());
      return this.processClassificationResult(
        data,
        message,
        null,
        attachmentsCount,
      );
    } catch (e) {
      this.logger.error(`Classification failed: ${e.message}. Using local fallback...`);
      return this.localClassify(message, role, undefined, attachmentsCount);
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

    return {
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
      language: data.language || 'en',
      reason:
        data.reason ||
        (wnResult?.route === 'HINT'
          ? 'AI classified with WordNet hint'
          : 'AI classified'),
      isLongRequest: isLong,
      sentenceCount: sentences.length,
      hasAttachments,
    };
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
      return this.result(
        forcedIntent,
        isLong || hasAttachments ? 3 : 1,
        mode(forcedIntent),
        lang,
        'WordNet DIRECT',
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
        'Payment signal',
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
        'Receipt request',
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
        'Arrears intent',
        isLong,
        sentences.length,
        hasAttachments,
      );
    }

    // Maintenance
    if (/maintenance|tap|sink|bomba|imevunjika|leak|broken/.test(text)) {
      const isTenantReport =
        /my |send someone|report|sink|kitchen|bathroom/.test(text);
      const intent = isTenantReport ? 'report_maintenance' : 'log_maintenance';
      return this.result(
        intent,
        1,
        mode(intent),
        lang,
        'Maintenance intent',
        isLong,
        sentences.length,
        hasAttachments,
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
        'Update property',
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
        'Simple lookup',
        isLong,
        sentences.length,
        hasAttachments,
      );
    }

    // Default
    const finalIntent = 'general_query';
    return this.result(
      finalIntent,
      isLong || hasAttachments ? 3 : 2,
      mode(finalIntent),
      lang,
      'Fallback',
      isLong,
      sentences.length,
      hasAttachments,
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
    reason: string,
    isLong?: boolean,
    sentenceCount?: number,
    hasAttachments?: boolean,
  ): ClassificationResult {
    return {
      intent,
      complexity,
      executionMode,
      language,
      reason,
      isLongRequest: isLong,
      sentenceCount,
      hasAttachments,
    };
  }
}
