import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { UserRole } from '../auth/roles.enum';
import { WordNetIntentResolver } from './wordnet-intent-resolver.util';


export interface ClassificationResult {
  intent: string;
  complexity: 1 | 2 | 3 | 4 | 5;
  executionMode: 'DIRECT_LOOKUP' | 'LIGHT_COMPOSE' | 'ORCHESTRATED' | 'INTELLIGENCE' | 'PLANNING';
  language: 'en' | 'sw' | 'mixed';
  reason: string;
  isLongRequest?: boolean;
  sentenceCount?: number;
}

@Injectable()
export class AiClassifierService implements OnModuleInit {
  private readonly logger = new Logger(AiClassifierService.name);
  private genAI: GoogleGenerativeAI;

  private readonly modelName = 'gemini-2.5-flash'; // Tier 1 model for classification
  private readonly apiKey: string;
  private readonly swKeywords = [
    'habari', 'mambo', 'bomba', 'imevunjika', 'kumbushia', 'wapangaji', 'mwezi',
    'hawajapaya', 'vitengo', 'wazi', 'risiti', 'nimetuma', 'nimepay', 'nimelipa',
    'malipo', 'mafuriko', 'moto', 'gesi', 'msaada', 'salio', 'niambie', 'boss'
  ];
  private readonly emergencyKeywords = [
    'fire', 'moto', 'flood', 'mafuriko', 'gas', 'gesi', 'help me', 'msaada',
    'injured', 'hurt', 'accident', 'collapse', 'umeme', 'electric', 'bleeding'
  ];
  private readonly paymentPatterns = [
    /nimetuma/i, /nimepay/i, /nimelipa/i, /nimefanya malipo/i,
    /pesa imeingia/i, /transferred/i, /i have paid/i, /sent.*money/i,
    /malipo yamefanyika/i, /boss.*pesa/i,
  ];

  constructor(private readonly wordnetResolver: WordNetIntentResolver) {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.genAI = new GoogleGenerativeAI(this.apiKey);
  }

  async onModuleInit() {
    await this.wordnetResolver.initialize();
  }


  async classify(message: string, role: UserRole, history: string[] = []): Promise<ClassificationResult> {
    // 1. WordNet Pre-Classifier (Layer 1 - DIRECT bypass)
    let wnResult: any = null;
    try {
      wnResult = this.wordnetResolver.resolve(message);
      if (wnResult.route === 'DIRECT') {
        this.logger.log(`[WordNet] DIRECT intent resolution: ${wnResult.intent} (conf: ${wnResult.confidence})`);
        return this.localClassify(message, role, wnResult.intent);
      }
    } catch (e) {
      this.logger.error(`WordNet resolution failed: ${e.message}`);
    }

    // Offline, deterministic classifier for test and dev environments without API keys
    if (!this.apiKey) {
      return this.localClassify(message, role);
    }


    const hint = (wnResult && wnResult.route === 'HINT') 
      ? `NOTE: WordNet heuristic suggests this might be "${wnResult.intent}" (confidence: ${wnResult.confidence.toFixed(2)}). Use this as a strong hint.`
      : '';

    const prompt = `
      You are an expert intent classifier for "Aedra", a property management AI.
      User Role: ${role}
      ${hint}
      
      Classify the user's message into an INTENT, COMPLEXITY SCORE (1-5), EXECUTION MODE, and LANGUAGE.
      ...
    `;

    try {
      const model = this.genAI.getGenerativeModel({ 
        model: this.modelName,
        generationConfig: { responseMimeType: 'application/json' }
      });
      
      const result = await model.generateContent(prompt);
      const data = JSON.parse(result.response.text());
      
      const sentences = message.split(/[.!?\n]+/).filter(s => s.trim().length > 5);
      const isLong = sentences.length > 2;

      return {
        intent: data.intent || (wnResult?.route === 'HINT' ? wnResult.intent : 'unknown'),
        complexity: (data.complexity >= 1 && data.complexity <= 5) ? data.complexity as any : (isLong ? 3 : 1),
        executionMode: isLong ? 'PLANNING' : (data.executionMode || 'DIRECT_LOOKUP'),
        language: data.language || 'en',
        reason: data.reason || (wnResult?.route === 'HINT' ? 'AI classified with WordNet hint' : 'AI classified'),
        isLongRequest: isLong,
        sentenceCount: sentences.length,
      };
    } catch (e) {
      this.logger.error(`Classification failed: ${e.message}`);
      return (wnResult && wnResult.route === 'HINT')
        ? this.localClassify(message, role, wnResult.intent)
        : {
            intent: 'unknown',
            complexity: 1,
            executionMode: 'DIRECT_LOOKUP',
            language: 'en',
            reason: 'Fallback due to error',
          };
    }
  }

  // ── Local heuristic classifier to keep tests offline ───────────
  private localClassify(message: string, role: UserRole, forcedIntent?: string): ClassificationResult {
    const text = (message || '').toLowerCase();
    const lang: ClassificationResult['language'] = this.detectLanguage(text);

    const sentences = (message || '').split(/[.!?\n]+/).filter(s => s.trim().length > 5);
    const isLong = sentences.length > 2;
    const mode = (forcedIntent: string) => isLong ? 'PLANNING' : (this.getDefaultMode(forcedIntent));

    if (forcedIntent) {
      return this.result(forcedIntent, isLong ? 3 : 1, mode(forcedIntent), lang, 'WordNet DIRECT', isLong, sentences.length);
    }


    // Emergency
    if (this.emergencyKeywords.some(kw => text.includes(kw))) {
      const intent = 'emergency_escalation';
      return this.result(intent, 1, mode(intent), lang, 'Emergency keyword match', isLong, sentences.length);
    }

    // Bulk reminders (order above arrears to avoid overlap)
    if (/remind|kumbushia/.test(text)) {
      const intent = 'send_bulk_reminder';
      return this.result(intent, isLong ? 3 : 2, mode(intent), lang, 'Reminder intent', isLong, sentences.length);
    }

    // Payment
    const hasPaymentSignal = this.paymentPatterns.some(p => p.test(message));
    const hasMpesaCode = /[A-Z0-9]{10}/.test(message);
    if (hasPaymentSignal || hasMpesaCode) {
      const intent = 'record_payment';
      return this.result(intent, isLong ? 3 : 2, mode(intent), lang, 'Payment signal', isLong, sentences.length);
    }

    // Receipt
    if (/receipt|risiti/.test(text)) {
      const intent = 'request_receipt';
      return this.result(intent, 1, mode(intent), lang, 'Receipt request', isLong, sentences.length);
    }

    // Arrears / rent status
    if (/who has not paid|hawajapaya|arrears|unpaid|collection/i.test(message)) {
      const intent = 'check_rent_status';
      return this.result(intent, 1, mode(intent), lang, 'Arrears intent', isLong, sentences.length);
    }

    // Maintenance
    if (/maintenance|tap|sink|bomba|imevunjika|leak|broken/.test(text)) {
      const isTenantReport = /my |send someone|report|sink|kitchen|bathroom/.test(text);
      const intent = isTenantReport ? 'report_maintenance' : 'log_maintenance';
      return this.result(intent, 1, mode(intent), lang, 'Maintenance intent', isLong, sentences.length);
    }

    // Reports
    if (/full report|request report|send.*report/.test(text)) {
      const intent = 'request_report';
      return this.result(intent, 3, mode(intent), lang, 'Report request', isLong, sentences.length);
    }
    if (/report|ripoti|mckinsey/.test(text)) {
      const intent = 'generate_mckinsey_report';
      return this.result(intent, 5, mode(intent), lang, 'Report intent', isLong, sentences.length);
    }

    // Vacancies
    if (/vacant|vacancies|which units are vacant|vitengo.*viko wazi/i.test(text)) {
      const intent = 'check_vacancy';
      return this.result(intent, 1, mode(intent), lang, 'Vacancy intent', isLong, sentences.length);
    }

    // Select company
    if (/select.*company|switch.*company|open.*company/i.test(text)) {
      const intent = 'select_company';
      return this.result(intent, 1, mode(intent), lang, 'Company selection', isLong, sentences.length);
    }

    // List companies
    if (/list.*compan|show.*compan/.test(text)) {
      const intent = 'list_companies';
      return this.result(intent, 1, mode(intent), lang, 'Company listing', isLong, sentences.length);
    }

    // Add tenant
    if (/add new tenant|create tenant|new tenant/i.test(text)) {
      const intent = 'add_tenant';
      return this.result(intent, 2, mode(intent), lang, 'Add tenant', isLong, sentences.length);
    }

    // Onboard Property / Unit
    if (/create property|new property|add property/i.test(text)) {
      const intent = 'onboard_property';
      return this.result(intent, 2, mode(intent), lang, 'Onboard property', isLong, sentences.length);
    }
    if (/create unit|add unit|new unit/i.test(text)) {
      const intent = 'create_unit';
      return this.result(intent, 2, mode(intent), lang, 'Create unit', isLong, sentences.length);
    }

    // Leases
    if (/create lease|new lease|add lease/i.test(text)) {
      const intent = 'create_lease';
      return this.result(intent, 2, mode(intent), lang, 'Create lease', isLong, sentences.length);
    }

    // Landlord collection queries
    if (/how much has been collected/i.test(text)) {
      const intent = 'collection_status';
      return this.result(intent, 1, mode(intent), lang, 'Collection status', isLong, sentences.length);
    }

    // Simple direct lookups that should stay cheap
    if (/how many tenants|how many units|list our companies|which units are vacant/i.test(text)) {
      const intent = 'general_query';
      return this.result(intent, 1, mode(intent), lang, 'Simple lookup', isLong, sentences.length);
    }

    // Default
    const finalIntent = 'general_query';
    return this.result(finalIntent, isLong ? 3 : 2, mode(finalIntent), lang, 'Fallback', isLong, sentences.length);
  }

  private getDefaultMode(intent: string): ClassificationResult['executionMode'] {
    switch (intent) {
      case 'generate_mckinsey_report': return 'INTELLIGENCE';
      case 'record_payment':
      case 'add_tenant':
      case 'onboard_property':
      case 'create_unit':
      case 'create_lease':
      case 'request_report': return 'ORCHESTRATED';
      case 'send_bulk_reminder':
      case 'general_query': return 'LIGHT_COMPOSE';
      default: return 'DIRECT_LOOKUP';
    }
  }

  private detectLanguage(text: string): ClassificationResult['language'] {
    const hasSw = this.swKeywords.some(kw => text.includes(kw));
    return hasSw ? 'sw' : 'en';
  }

  private result(intent: string, complexity: ClassificationResult['complexity'], executionMode: ClassificationResult['executionMode'], language: ClassificationResult['language'], reason: string, isLong?: boolean, sentenceCount?: number): ClassificationResult {
    return { intent, complexity, executionMode, language, reason, isLongRequest: isLong, sentenceCount };
  }
}
