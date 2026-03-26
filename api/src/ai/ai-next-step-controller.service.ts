import { Injectable, Logger } from '@nestjs/common';

export interface IntentConstraints {
  intent: string;
  allowedTools: string[];   // Primary actions for the intent
  secondaryTools?: string[]; // Context-enriching actions
  fallbackTools?: string[];  // Safe informational actions
  requiredPreconditions: Record<string, string[]>; // tool -> [prerequisite_tools]
  forbiddenActions: string[];
  mandatoryFirstAction?: string;
  recoverySequence?: Record<string, string[]>;
  fallbackChains?: Record<string, string[]>; // Phase 7: Alternative tool paths
  desiredOutcome: string; // Phase 7: The business goal
  actionPriority: 'DATA_FIRST' | 'ACK_FIRST' | 'SILENT' | 'IMMEDIATE' | 'RESOLVE_FIRST';
}

@Injectable()
export class AiNextStepController {
  private readonly logger = new Logger(AiNextStepController.name);

  // Intent-specific constraint definitions
  private readonly INTENT_REGISTRY: Record<string, IntentConstraints> = {
    NOISE_COMPLAINT: {
      intent: 'TENANT_DISPUTE',
      allowedTools: ['log_tenant_incident', 'send_whatsapp_message', 'get_tenant_details'],
      secondaryTools: ['list_tenant_incidents'],
      fallbackTools: ['search_tenants', 'list_units'],
      requiredPreconditions: {},
      forbiddenActions: [
        'NEVER mention technicians or maintenance visits for noise/social complaints.',
        'Do not promising a physical site visit for noise.',
      ],
      actionPriority: 'ACK_FIRST',
      desiredOutcome: 'Log incident and notify occupant discreetly. NO technicians.'
    },
    LATE_PAYMENT: {
      intent: 'LATE_PAYMENT',
      allowedTools: ['log_tenant_incident', 'get_tenant_arrears', 'send_whatsapp_message'],
      secondaryTools: ['get_tenant_details', 'search_tenants'],
      fallbackTools: ['ai_read_tool', 'list_units'],
      requiredPreconditions: {
        send_whatsapp_message: ['get_tenant_arrears'],
        create_todo: ['get_tenant_arrears'],
      },
      forbiddenActions: [
        'Do not disclose other tenants\' names or balances.',
        'Do not threaten legal action unless arrears exceed 30 days.',
      ],
      desiredOutcome: 'PRIORITY: Acknowledge the date/amount first. Identity resolution is secondary.',
      actionPriority: 'ACK_FIRST',
    },
    WORKFLOW_DEPENDENCY: {
      intent: 'WORKFLOW_DEPENDENCY',
      allowedTools: ['check_plan_status', 'register_tenant', 'search_tenants'],
      secondaryTools: ['get_unit_details', 'list_units'],
      requiredPreconditions: {
        register_tenant: ['check_plan_status'],
      },
      forbiddenActions: [
        'Do not register a tenant if the unit is not vacant or plan is inactive.',
      ],
      mandatoryFirstAction: 'search_tenants',
      desiredOutcome: 'Resolve entity ID to proceed with original intent',
      actionPriority: 'SILENT',
    },
    PORTFOLIO_PERFORMANCE: {
      intent: 'PORTFOLIO_PERFORMANCE',
      allowedTools: ['get_portfolio_arrears', 'get_collection_rate', 'summarize_portfolio'],
      secondaryTools: ['list_properties', 'get_property_details'],
      fallbackTools: ['list_units'],
      requiredPreconditions: {},
      forbiddenActions: [
        'Do not disclose individual tenant contact details in a summary report.',
      ],
      mandatoryFirstAction: 'get_portfolio_arrears',
      fallbackChains: {
        'get_portfolio_arrears': ['list_properties', 'get_collection_rate']
      },
      desiredOutcome: 'Show overall portfolio health and arrears status',
      actionPriority: 'DATA_FIRST',
    },
    EMERGENCY: {
      intent: 'EMERGENCY',
      allowedTools: ['log_maintenance_issue', 'get_unit_details', 'get_tenant_details'],
      secondaryTools: ['send_whatsapp_message', 'create_todo'],
      requiredPreconditions: {},
      forbiddenActions: [
        'Do not delay safety instructions for data collection.',
        'NEVER block maintenance logging if unit is unknown - use "UNSPECIFIED" or "PENDING".',
        'SEVERITY CALIBRATION: "Burst pipe" or "Flooding" = Level 5 (Evacuate/Emergency). "Leaking" or "Drip" = Level 3 (Urgent).',
      ],
      mandatoryFirstAction: 'log_maintenance_issue',
      desiredOutcome: 'Log issue and reassure tenant of technician dispatch. Calibrate severity.',
      actionPriority: 'ACK_FIRST',
    },
    MAINTENANCE: {
      intent: 'MAINTENANCE',
      allowedTools: ['log_maintenance_issue', 'get_unit_details'],
      secondaryTools: ['list_units', 'get_tenant_details'],
      fallbackTools: ['create_todo'],
      requiredPreconditions: {},
      forbiddenActions: [
        'Acknowledge the request immediately before asking for unit details.',
        'TAXONOMY: "Painting", "Cosmetic", "Squeaky" = LOW. "Plumbing", "Electrical", "Leak" = MEDIUM. "Structural", "Roof" = HIGH.',
      ],
      mandatoryFirstAction: 'log_maintenance_issue',
      desiredOutcome: 'Log issue with PRIORITY calibration. Reassure tenant.',
      actionPriority: 'ACK_FIRST',
    },
    FINANCIAL_REPORTING: {
      intent: 'FINANCIAL_REPORTING',
      allowedTools: ['get_revenue_summary', 'get_collection_rate', 'list_payments'],
      secondaryTools: ['list_properties', 'get_portfolio_arrears'],
      fallbackTools: ['list_payments', 'list_invoices'],
      requiredPreconditions: {},
      forbiddenActions: [
        'If a property name is slightly off, use list_properties to find the correct one instead of saying "not found".',
      ],
      mandatoryFirstAction: 'get_revenue_summary',
      fallbackChains: {
        'get_revenue_summary': ['list_payments', 'manual_aggregation'],
        'get_collection_rate': ['list_payments']
      },
      desiredOutcome: 'FORCE_VALUE: Provide manual aggregation if primary tools fail. Never say "unavailable".',
      actionPriority: 'DATA_FIRST',
    }
  };

  getConstraints(intent: string): IntentConstraints | null {
    const constraints = this.INTENT_REGISTRY[intent];
    if (!constraints) {
      return null;
    }
    return constraints;
  }

  generatePromptConstraints(intent: string, executionHistory: string[]): string {
    const constraints = this.getConstraints(intent);
    if (!constraints) return '';

    let prompt = `\n[🚨 DETERMINISTIC OS CONSTRAINTS: ${intent} 🚨]\n`;
    prompt += `[TARGET OUTCOME]: ${constraints.desiredOutcome}\n`;
    
    // Tool Ranking
    prompt += `PRIMARY TOOLS: ${constraints.allowedTools.join(', ')}\n`;
    if (constraints.secondaryTools?.length) {
      prompt += `SECONDARY TOOLS: ${constraints.secondaryTools.join(', ')}\n`;
    }
    if (constraints.fallbackTools?.length) {
      prompt += `FALLBACK TOOLS: ${constraints.fallbackTools.join(', ')}\n`;
    }
    
    // Check prerequisites
    const fulfilled = new Set(executionHistory);
    const pendingPrereqs: string[] = [];
    
    for (const [tool, prereqs] of Object.entries(constraints.requiredPreconditions)) {
      const missing = prereqs.filter(p => !fulfilled.has(p));
      if (missing.length > 0) {
        pendingPrereqs.push(`To use '${tool}', you MUST first run: ${missing.join(', ')}`);
      }
    }

    if (pendingPrereqs.length > 0) {
      prompt += `Prerequisite Guards:\n- ${pendingPrereqs.join('\n- ')}\n`;
    }

    prompt += `Safety/Policy Bounds:\n- ${constraints.forbiddenActions.join('\n- ')}\n`;
    
    if (constraints.mandatoryFirstAction) {
      prompt += `[MANDATORY FIRST ACTION]: You MUST execute '${constraints.mandatoryFirstAction}' in your very first step.\n`;
    }
    if (constraints.fallbackChains) {
      prompt += `[OUTCOME RESOLUTION FALLBACKS]: If primary tools fail or return NO_DATA, you MUST attempt these synthesis chains: ${JSON.stringify(constraints.fallbackChains)}\n`;
    }
    prompt += `[ACTION PRIORITY]: ${this.getPriorityDescription(constraints.actionPriority)}\n`;

    return prompt;
  }

  private getPriorityDescription(p: string): string {
    switch(p) {
        case 'IMMEDIATE': return 'ACT immediately WITHOUT excessive greeting.';
        case 'ACK_FIRST': return 'ACKNOWLEDGE user warmly THEN take action.';
        case 'DATA_FIRST': return 'PRIORITIZE providing the hard data/result immediately.';
        case 'SILENT': return 'Process quietly without redundant commentary.';
        case 'RESOLVE_FIRST': return 'SEARCH/VALIDATE first THEN finalize action.';
        default: return 'Standard procedure.';
    }
  }
}
