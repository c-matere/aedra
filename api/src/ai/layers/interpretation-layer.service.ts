import { Injectable, Logger } from '@nestjs/common';
import { AiClassifierService } from '../ai-classifier.service';
import {
  Interpretation,
  AiIntent,
  OperationalIntent,
  ExecutionTrace,
} from '../ai-contracts.types';
import { RoleRouter } from '../role-router.service';
import { UserRole } from '../../auth/roles.enum';

@Injectable()
export class InterpretationLayer {
  private readonly logger = new Logger(InterpretationLayer.name);

  constructor(
    private readonly classifier: AiClassifierService,
    private readonly roleRouter: RoleRouter,
  ) {}

  async interpret(
    trace: ExecutionTrace,
    history: string[] = [],
    context: any = {},
  ): Promise<ExecutionTrace> {
    const { input, role } = trace;

    // 0. Intent Locking & Stickiness (Aedra v5.0 Role-Isolated Precision Gating)
    const lockedIntent =
      context?.lockedState?.lockedIntent || context?.lastIntent;
    const strategy = this.roleRouter.getStrategy(role || 'TENANT');

    // VALIDATE LOCK: Ensure the locked intent is actually allowed for this role
    // This prevents "Intent Bleed" if a session is reused or a role is downgraded
    const isLockedIntentValidForRole = this.isIntentValidForRole(
      lockedIntent,
      role,
    );

    const isStickyIntent = [
      'MAINTENANCE_REQUEST',
      'PAYMENT_PROMISE',
      'UTILITY_OUTAGE',
      'PAYMENT_DECLARATION',
    ].includes(lockedIntent as string);
    const hasActiveIssue =
      context.activeIssueId ||
      context.activeIssueDescription ||
      context.lockedState?.activeIssueId;

    if (
      lockedIntent &&
      lockedIntent !== 'GENERAL_QUERY' &&
      isLockedIntentValidForRole &&
      (isStickyIntent || context?.lockedState?.lockedIntent || hasActiveIssue)
    ) {
      this.logger.log(
        `[Interpretation] Intent Persisted/Locked for ${role}: ${lockedIntent}`,
      );

      // If we have an active issue but the locked intent is GENERAL_QUERY, upgrade it to MAINTENANCE_REQUEST
      const effectiveLockedIntent =
        hasActiveIssue && lockedIntent === 'GENERAL_QUERY'
          ? AiIntent.MAINTENANCE_REQUEST
          : (lockedIntent as AiIntent);

      trace.interpretation = {
        intent: effectiveLockedIntent,
        operationalIntent: OperationalIntent.STANDARD,
        entities: {
          ...context.lastEntities?.reduce(
            (acc: any, e: any) => ({ ...acc, [e.type]: e.id }),
            {},
          ),
          issueId: context.activeIssueId || context.lockedState?.activeIssueId,
          issue_details:
            context.activeIssueDescription ||
            context.lockedState?.activeIssueDescription,
          unitId: context.activeUnitId || context.lockedState?.activeUnitId,
          tenantId:
            context.activeTenantId || context.lockedState?.activeTenantId,
        },
        confidence: 1.0,
        language: this.detectLanguage(input),
        priority: context.lastPriority || 'NORMAL',
      };
      trace.intentLock = true;

      // Removed early return to allow Strategy/Classifier to run and extract NEW entities from 'input'
    }

    this.logger.log(
      `[Interpretation] Interpreting message: "${input.substring(0, 50)}..."`,
    );
    trace.status = 'INTERPRETING';

    // 1. Early Exit for System Failures vs Maintenance
    if (this.isSystemFailure(input) && !this.isMaintenance(input)) {
      trace.interpretation = {
        intent: AiIntent.SYSTEM_FAILURE,
        operationalIntent: OperationalIntent.TECHNICAL_APOLOGY,
        entities: {},
        confidence: 1.0,
        language: this.detectLanguage(input),
        priority: 'HIGH',
      };
      return trace;
    }

    // 2. Resolve via Role-Isolated Strategy
    const strategyUsed = this.roleRouter.getStrategy(role || 'TENANT');
    const result = await strategyUsed.resolveIntent(input, history, context);

    // 3. Map to strict Interpretation schema
    const intent = result.intent || AiIntent.GENERAL_QUERY;
    const operationalIntent = this.deriveOperationalIntent(input, intent);

    trace.interpretation = {
      intent,
      operationalIntent,
      entities: {
        ...result.entities,
        tenantName:
          (result.entities as any)?.tenantName ||
          (result.entities as any)?.name ||
          trace.metadata?.activeTenantName,
        tenantId:
          (result.entities as any)?.tenantId || trace.metadata?.activeTenantId,
        unitId:
          (result.entities as any)?.unitId || trace.metadata?.activeUnitId,
        unitNumber:
          (result.entities as any)?.unit ||
          (result.entities as any)?.unitNumber,
        issue_details:
          (result.entities as any)?.issue_details ||
          (result.entities as any)?.description ||
          trace.metadata?.activeIssueDescription,
      },
      proposedValues: {
        amount: (result.entities as any)?.amount,
        description:
          (result.entities as any)?.issue_details ||
          (result.entities as any)?.description,
        unit:
          (result.entities as any)?.unit ||
          (result.entities as any)?.unitNumber,
        isEmergency: intent === AiIntent.EMERGENCY,
        isUtilityOutage: intent === AiIntent.UTILITY_OUTAGE,
      },
      confidence: result.confidence || 0.5,
      language: (result.language as any) || this.detectLanguage(input),
      priority: result.priority || 'NORMAL',
    };

    // MOMBASA FIX: Ensure re-hydrated IDs are explicitly in the entities for downstream tools
    if (trace.interpretation) {
      if (trace.metadata?.activeTenantId)
        trace.interpretation.entities.tenantId = trace.metadata.activeTenantId;
      if (trace.metadata?.activeUnitId)
        trace.interpretation.entities.unitId = trace.metadata.activeUnitId;
      if (trace.metadata?.activePropertyId)
        trace.interpretation.entities.propertyId =
          trace.metadata.activePropertyId;
      if (trace.metadata?.activeIssueId)
        trace.interpretation.entities.issueId = trace.metadata.activeIssueId;
      if (trace.metadata?.activeIssueDescription) {
        trace.interpretation.entities.issue_details =
          trace.metadata.activeIssueDescription;
        // Inject hint for turn-aware maintenance
        if (
          trace.interpretation.intent === AiIntent.MAINTENANCE_REQUEST ||
          trace.interpretation.intent === AiIntent.GENERAL_QUERY
        ) {
          trace.interpretation.raw_reasoning += ` [Turn-Aware Context: Continuing issue "${trace.metadata.activeIssueDescription}"]`;
        }
      }
    }

    return trace;
  }

  private isMaintenance(message: string): boolean {
    const msg = message.toLowerCase();
    const maintenanceKeywords = [
      'maji',
      'bomba',
      'sink',
      'plumber',
      'rearing',
      'paint',
      'leak',
      'flooding',
      'shida',
      'broken',
    ];
    return maintenanceKeywords.some((k) => msg.includes(k));
  }

  public mapToAiIntent(intent: string, input: string): AiIntent {
    const msg = input.toLowerCase();

    // Dispute Detection (Pattern D Fix)
    if (
      msg.includes('wrong') ||
      msg.includes('penalty') ||
      msg.includes('makosa') ||
      msg.includes('dispute')
    ) {
      return AiIntent.DISPUTE;
    }

    // UTILITY_OUTAGE vs EMERGENCY Split
    const outageKeywords = [
      'maji imepotea',
      'maji hayatoki',
      'sina maji',
      'umeme imevatika',
      'power out',
      'no water',
    ];
    const emergencyKeywords = [
      'imepasuka',
      'imepasua',
      'moto',
      'imejaa',
      'flooding',
      'burst',
      'fire',
    ];

    if (outageKeywords.some((k) => msg.includes(k)))
      return AiIntent.UTILITY_OUTAGE;
    if (emergencyKeywords.some((k) => msg.includes(k)))
      return AiIntent.EMERGENCY;

    const map: Record<string, AiIntent> = {
      maintenance_request: AiIntent.MAINTENANCE_REQUEST,
      tenant_complaint: AiIntent.TENANT_COMPLAINT,
      record_payment: AiIntent.PAYMENT_DECLARATION,
      payment_declaration: AiIntent.PAYMENT_DECLARATION,
      financial_query: AiIntent.FINANCIAL_QUERY,
      financial_reporting: AiIntent.FINANCIAL_REPORTING,
      onboarding: AiIntent.ONBOARDING,
      system_failure: AiIntent.SYSTEM_FAILURE,
      general_query: AiIntent.GENERAL_QUERY,
      emergency: AiIntent.EMERGENCY,
      dispute: AiIntent.DISPUTE,
    };
    return map[intent?.toLowerCase()] || AiIntent.GENERAL_QUERY;
  }

  private deriveOperationalIntent(
    message: string,
    intent: AiIntent,
  ): OperationalIntent {
    const msg = message.toLowerCase();

    if (intent === AiIntent.TENANT_COMPLAINT)
      return OperationalIntent.REASSURE_AND_ESCALATE;
    if (intent === AiIntent.SYSTEM_FAILURE)
      return OperationalIntent.TECHNICAL_APOLOGY;

    if (
      msg.includes('will pay') ||
      msg.includes('nitakulipa') ||
      msg.includes('promise')
    ) {
      return OperationalIntent.ACKNOWLEDGE_AND_POLICY;
    }

    if (
      msg.includes('wrong') ||
      msg.includes('penalty') ||
      msg.includes('dispute')
    ) {
      return OperationalIntent.INVESTIGATE;
    }

    return OperationalIntent.STANDARD;
  }

  private isSystemFailure(message: string): boolean {
    const msg = message.toLowerCase();
    // Specific technical/software failure keywords
    return (
      msg.includes('haitaki') ||
      msg.includes('not working') ||
      msg.includes('error') ||
      msg.includes('download') ||
      msg.includes('upload') ||
      msg.includes('password') ||
      msg.includes('login')
    );
  }

  private detectLanguage(message: string): 'en' | 'sw' | 'mixed' {
    const msg = message.toLowerCase();
    const swahiliKeywords = [
      'haitaki',
      'shida',
      'bomba',
      'imepasuka',
      'maji',
      'imejaa',
      'nipe',
      'weka',
      'ngapi',
    ];
    const hasSwahili = swahiliKeywords.some((k) => msg.includes(k));
    const hasEnglish = /[a-z]/i.test(message) && !hasSwahili; // Simple heuristic

    if (hasSwahili && message.split(' ').length > 2) return 'mixed';
    return hasSwahili ? 'sw' : 'en';
  }

  private isIntentValidForRole(
    intent: string | undefined,
    role: string | undefined,
  ): boolean {
    if (!intent) return false;
    const r = (role || 'TENANT').toUpperCase();

    const roleIntents: Record<string, string[]> = {
      TENANT: [
        AiIntent.MAINTENANCE_REQUEST,
        AiIntent.PAYMENT_PROMISE,
        AiIntent.PAYMENT_DECLARATION,
        AiIntent.TENANT_COMPLAINT,
        AiIntent.EMERGENCY,
        AiIntent.UTILITY_OUTAGE,
        AiIntent.GENERAL_QUERY,
        AiIntent.DISPUTE,
      ],
      COMPANY_STAFF: [
        AiIntent.ONBOARDING,
        AiIntent.FINANCIAL_REPORTING,
        AiIntent.FINANCIAL_QUERY,
        AiIntent.MAINTENANCE_REQUEST,
        AiIntent.GENERAL_QUERY,
        AiIntent.SYSTEM_FAILURE,
      ],
      STAFF: [
        AiIntent.ONBOARDING,
        AiIntent.FINANCIAL_REPORTING,
        AiIntent.FINANCIAL_QUERY,
        AiIntent.MAINTENANCE_REQUEST,
        AiIntent.GENERAL_QUERY,
        AiIntent.SYSTEM_FAILURE,
      ],
      LANDLORD: [
        AiIntent.FINANCIAL_REPORTING,
        AiIntent.FINANCIAL_QUERY,
        AiIntent.GENERAL_QUERY,
      ],
    };

    return roleIntents[r]?.includes(intent as AiIntent) ?? false;
  }
}
