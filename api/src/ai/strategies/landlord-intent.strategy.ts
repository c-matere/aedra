import { Injectable, Logger } from '@nestjs/common';
import { AiStrategy } from '../ai-strategies.types';
import { Interpretation, AiIntent } from '../ai-contracts.types';
import { UserRole } from '../../auth/roles.enum';
import { AiClassifierService } from '../ai-classifier.service';

@Injectable()
export class LandlordIntentStrategy implements AiStrategy {
  private readonly logger = new Logger(LandlordIntentStrategy.name);
  readonly role = 'LANDLORD';

  constructor(private readonly classifier: AiClassifierService) {}

  async resolveIntent(
    message: string,
    history: any[],
    context: any,
  ): Promise<Partial<Interpretation>> {
    this.logger.log(
      `[LandlordStrategy] Resolving intent for message: ${message.substring(0, 30)}...`,
    );
    const text = (message || '').toLowerCase();

    // 1. DETERMINISTIC ACTION GATING
    // Revenue / Collection
    if (/(revenue|collection|profit|income|mapato|makusanyo)/i.test(text)) {
      this.logger.log(
        '[LandlordStrategy] Gating: Revenue/Collection Query detected.',
      );
      return {
        intent: AiIntent.FINANCIAL_REPORTING,
        confidence: 0.98,
      };
    }

    // Vacancy
    if (/(vacancy|vacant|wazi|vitengo.*wazi)/i.test(text)) {
      this.logger.log('[LandlordStrategy] Gating: Vacancy Report detected.');
      return {
        intent: AiIntent.FINANCIAL_QUERY,
        confidence: 0.95,
      };
    }

    // 2. LLM-BASED REFINEMENT
    const result = await this.classifier.classifyForRole(
      message,
      'LANDLORD',
      context,
    );

    // Map internal strings to AiIntent enum
    const intentMap: Record<string, AiIntent> = {
      collection_status: AiIntent.FINANCIAL_REPORTING,
      revenue_summary: AiIntent.FINANCIAL_REPORTING,
      vacancy_report: AiIntent.FINANCIAL_QUERY,
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
    // Landlord-specific projection: Analytical aggregates, no individual IDs
    if (!rawTruth) return null;

    // If it's a list, aggregate it
    if (Array.isArray(rawTruth.data)) {
      return {
        summary: rawTruth.summary || 'Analytical report generated.',
        aggregates: {
          totalCount: rawTruth.data.length,
          totalValue: (rawTruth.data as any[]).reduce(
            (acc: number, curr: any) => acc + (curr.amount || 0),
            0,
          ),
        },
        timestamp: new Date().toISOString(),
      };
    }

    return {
      summary: rawTruth.summary || 'High-level summary retrieved.',
      data: rawTruth.human_summary || undefined,
    };
  }
}
