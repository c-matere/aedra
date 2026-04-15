import { Injectable, Logger } from '@nestjs/common';
import { AiStrategy } from '../ai-strategies.types';
import { Interpretation, AiIntent } from '../ai-contracts.types';
import { UserRole } from '../../auth/roles.enum';
import { AiClassifierService } from '../ai-classifier.service';

@Injectable()
export class StaffIntentStrategy implements AiStrategy {
  private readonly logger = new Logger(StaffIntentStrategy.name);
  readonly role = 'COMPANY_STAFF';

  constructor(private readonly classifier: AiClassifierService) {}

  async resolveIntent(
    message: string,
    history: any[],
    context: any,
  ): Promise<Partial<Interpretation>> {
    this.logger.log(
      `[StaffStrategy] Resolving intent for message: ${message.substring(0, 30)}...`,
    );
    const text = (message || '').toLowerCase();

    // 1. DETERMINISTIC ACTION GATING
    // Onboarding / Tenant Registration
    if (
      /(weka|onboard|register|add).*tenant/i.test(text) ||
      /(import|bulk).*tenant/i.test(text)
    ) {
      this.logger.log('[StaffStrategy] Gating: Tenant Onboarding detected.');
      return {
        intent: AiIntent.ONBOARDING,
        confidence: 0.95,
      };
    }

    // Maintenance (Staff acting as reporter/fixer)
    if (
      /(plumber|sink|blocked|leak|pipe|toilet|repair|mabati|fundi|eleki|stima)/i.test(
        text,
      )
    ) {
      this.logger.log('[StaffStrategy] Gating: Maintenance keywords detected.');
      return {
        intent: AiIntent.MAINTENANCE_REQUEST,
        confidence: 0.9, // Allow LLM to still extract entities
      };
    }

    // Financial Status / Collection
    if (
      /(collection|rent|arrears|outstanding|mapato|makusanyo).*status/i.test(
        text,
      ) ||
      /who.*not.*paid/i.test(text)
    ) {
      this.logger.log('[StaffStrategy] Gating: Collection Status detected.');
      return {
        intent: AiIntent.FINANCIAL_REPORTING,
        confidence: 0.98,
      };
    }

    // Vacancy
    if (/(vacancy|vacant|wazi|vitengo.*wazi)/i.test(text)) {
      this.logger.log('[StaffStrategy] Gating: Vacancy Check detected.');
      return {
        intent: AiIntent.FINANCIAL_QUERY, // check_vacancy maps here in staff-intent.strategy.ts
        confidence: 0.95,
      };
    }

    // 2. LLM-BASED REFINEMENT
    const result = await this.classifier.classifyForRole(
      message,
      'COMPANY_STAFF',
      context,
    );

    // Map internal strings to AiIntent enum
    const intentMap: Record<string, AiIntent> = {
      onboard_property: AiIntent.ONBOARDING,
      bulk_create_tenants: AiIntent.ONBOARDING,
      add_tenant: AiIntent.ONBOARDING,
      update_property: AiIntent.ONBOARDING,
      create_unit: AiIntent.ONBOARDING,
      create_lease: AiIntent.ONBOARDING,
      collection_status: AiIntent.FINANCIAL_REPORTING,
      record_expense: AiIntent.ONBOARDING,
      list_expenses: AiIntent.FINANCIAL_REPORTING,
      check_rent_status: AiIntent.FINANCIAL_QUERY,
      send_bulk_reminder: AiIntent.FINANCIAL_REPORTING,
      check_vacancy: AiIntent.FINANCIAL_QUERY,
      general_query: AiIntent.GENERAL_QUERY,
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
    // Staff-specific projection: Operational with IDs and tables
    if (!rawTruth) return null;
    return rawTruth; // Staff get the "unfiltered" truth (with IDs)
  }
}
