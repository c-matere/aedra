import { Injectable, Logger } from '@nestjs/common';
import {
  Interpretation,
  ActionContract,
  AiIntent,
  OperationalIntent,
  ExecutionTrace,
} from '../ai-contracts.types';

@Injectable()
export class DecisionLayer {
  private readonly logger = new Logger(DecisionLayer.name);

  resolveAction(trace: ExecutionTrace): ExecutionTrace {
    const { interpretation, role } = trace;
    if (!interpretation) {
      this.logger.error(
        `[Decision] Missing interpretation in trace: ${trace.id}`,
      );
      trace.status = 'FAILED';
      trace.errors.push('Missing interpretation for decision resolution.');
      return trace;
    }

    this.logger.log(
      `[Decision] Resolving action for ROLE: ${role} | intent: ${interpretation.intent}`,
    );
    trace.status = 'DECIDING';

    // 1. Role-Based Contract Lookup (Deterministic Intent Lock)
    let contract: ActionContract;

    // We use a hybrid approach: Role-Isolated Switch for high-precision gating
    const r = (role || 'TENANT').toUpperCase();

    if (r === 'TENANT') {
      switch (interpretation.intent) {
        case AiIntent.MAINTENANCE_REQUEST:
          contract = {
            type: OperationalIntent.STANDARD,
            intent: AiIntent.MAINTENANCE_REQUEST,
            requiredTools: ['log_maintenance_issue', 'get_unit_details'],
            requiresContext: trace.metadata?.activeUnitId ? [] : ['unitId'],
            forbiddenActions: [
              'Do not ask for unit if it is in the context.',
              'Acknowledge before asking for details.',
            ],
            actionPriority: 'ACK_FIRST',
            completionCriteria: {
              mandatoryTools: ['log_maintenance_issue'],
              requiredFields: ['maintenanceId'],
            },
          };
          break;
        case AiIntent.PAYMENT_DECLARATION:
          contract = {
            type: OperationalIntent.STANDARD,
            intent: AiIntent.PAYMENT_DECLARATION,
            requiredTools: ['record_payment', 'get_tenant_details'],
            requiresContext: trace.metadata?.activeTenantId ? [] : ['tenantId'],
            forbiddenActions: [
              'Do not accept partial payments without acknowledgement.',
            ],
            actionPriority: 'DATA_FIRST',
            completionCriteria: {
              mandatoryTools: ['record_payment'],
              requiredFields: ['amount', 'paymentId'],
            },
          };
          break;
        case AiIntent.UTILITY_OUTAGE:
        case AiIntent.EMERGENCY:
          contract = {
            type: OperationalIntent.STANDARD,
            intent: interpretation.intent,
            requiredTools: ['log_maintenance_issue', 'get_unit_details'],
            requiresContext: [],
            forbiddenActions: ['Do not delay safety instructions.'],
            actionPriority: 'IMMEDIATE',
            completionCriteria: { mandatoryTools: ['log_maintenance_issue'] },
          };
          break;
        default:
          contract = this.getDefaultTenantContract(interpretation.intent);
      }
    } else if (r === 'COMPANY_STAFF' || r === 'STAFF') {
      switch (interpretation.intent) {
        case AiIntent.ONBOARDING:
          contract = {
            type: OperationalIntent.STANDARD,
            intent: AiIntent.ONBOARDING,
            requiredTools: ['onboard_property', 'add_tenant'],
            requiresContext: ['propertyId'],
            forbiddenActions: [],
            actionPriority: 'DATA_FIRST',
            completionCriteria: {
              mandatoryTools: ['onboard_property'],
              requiredFields: ['propertyId'],
            },
          };
          break;
        case AiIntent.FINANCIAL_REPORTING:
          contract = {
            type: OperationalIntent.STANDARD,
            intent: AiIntent.FINANCIAL_REPORTING,
            requiredTools: [
              'get_revenue_summary',
              'get_collection_rate',
              'list_payments',
            ],
            requiresContext: [],
            forbiddenActions: ['Use manual aggregation if primary tools fail.'],
            actionPriority: 'DATA_FIRST',
            completionCriteria: {
              mandatoryTools: ['get_revenue_summary'],
              requiredFields: ['revenueData'],
            },
          };
          break;
        default:
          contract = this.getDefaultStaffContract(interpretation.intent);
      }
    } else {
      // Default / Landlord
      contract = {
        type: OperationalIntent.STANDARD,
        intent: interpretation.intent,
        requiredTools: [],
        requiresContext: [],
        forbiddenActions: [],
        actionPriority:
          interpretation.intent === AiIntent.SYSTEM_FAILURE
            ? 'IMMEDIATE'
            : 'ACK_FIRST',
      };
    }

    trace.actionContract = contract;
    return trace;
  }

  private getDefaultTenantContract(intent: AiIntent): ActionContract {
    return {
      type: OperationalIntent.STANDARD,
      intent,
      requiredTools: [],
      requiresContext: [],
      forbiddenActions: [
        'NEVER show staff-level financial tables.',
        'Do not reveal unit vacancies.',
      ],
      actionPriority: 'ACK_FIRST',
    };
  }

  private getDefaultStaffContract(intent: AiIntent): ActionContract {
    return {
      type: OperationalIntent.STANDARD,
      intent,
      requiredTools: [],
      requiresContext: [],
      forbiddenActions: [],
      actionPriority: 'DATA_FIRST',
    };
  }
}
