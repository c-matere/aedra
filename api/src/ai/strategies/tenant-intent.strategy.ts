import { Injectable, Logger } from '@nestjs/common';
import { AiStrategy } from '../ai-strategies.types';
import { Interpretation, AiIntent } from '../ai-contracts.types';
import { UserRole } from '../../auth/roles.enum';
import { AiClassifierService } from '../ai-classifier.service';

@Injectable()
export class TenantIntentStrategy implements AiStrategy {
  private readonly logger = new Logger(TenantIntentStrategy.name);
  readonly role = 'TENANT';

  constructor(private readonly classifier: AiClassifierService) {}

  async resolveIntent(message: string, history: any[], context: any): Promise<Partial<Interpretation>> {
    this.logger.log(`[TenantStrategy] Resolving intent for message: ${message.substring(0, 30)}...`);
    const text = (message || '').toLowerCase();

    // 1. DETERMINISTIC ACTION GATING (Bypass LLM for known patterns)
    // Emergency / Maintenance Outage
    if (/(maji.*limepotea|no water|bomba.*imepasuka|burst.*pipe|flood|moto|fire)/i.test(text)) {
      this.logger.log('[TenantStrategy] Gating: Emergency/Outage detected.');
      return {
        intent: text.includes('maji') || text.includes('water') ? AiIntent.UTILITY_OUTAGE : AiIntent.EMERGENCY,
        priority: 'EMERGENCY',
        confidence: 1.0,
      };
    }

    // Payment Declaration
    if (/(nimetuma|nimepay|nimelipa|i have paid|sent.*money)/i.test(text) || /[A-Z0-9]{10}/.test(message)) {
      this.logger.log('[TenantStrategy] Gating: Payment Declaration detected.');
      return {
        intent: AiIntent.PAYMENT_DECLARATION,
        confidence: 0.98,
      };
    }

    // Small-Talk / Acknowledgment (Polite Wall Killers)
    if (/^(ok|okay|sawa|asante|thanks|thank you|poa)$/i.test(text.trim())) {
      this.logger.log('[TenantStrategy] Gating: Acknowledgment detected.');
      return {
        intent: AiIntent.GENERAL_QUERY,
        confidence: 1.0,
      };
    }

    // 2. LLM-BASED REFINEMENT (Role-Isolated Intent Space)
    const result = await this.classifier.classifyForRole(message, 'TENANT', context);
    
    // Map internal strings to AiIntent enum
    const intentMap: Record<string, AiIntent> = {
      'maintenance_request': AiIntent.MAINTENANCE_REQUEST,
      'payment_promise': AiIntent.PAYMENT_PROMISE,
      'payment_declaration': AiIntent.PAYMENT_DECLARATION,
      'tenant_complaint': AiIntent.TENANT_COMPLAINT,
      'emergency_escalation': AiIntent.EMERGENCY,
      'general_query': AiIntent.GENERAL_QUERY,
    };

    return {
      intent: intentMap[result.intent] || AiIntent.GENERAL_QUERY,
      entities: result.entities as any,
      priority: result.priority as any,
      language: result.language,
      confidence: result.confidence,
    };
  }

  projectTruth(rawTruth: any): any {
    // Tenant-specific projection: Human readable, no internal IDs or raw tables
    if (!rawTruth) return null;
    
    return {
      summary: rawTruth.summary || rawTruth.message || 'Details retrieved.',
      verifiedData: rawTruth.amount !== undefined ? { amount: rawTruth.amount, status: rawTruth.status } : undefined,
      timestamp: new Date().toISOString(),
    };
  }
}
