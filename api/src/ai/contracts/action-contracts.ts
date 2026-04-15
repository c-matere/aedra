import { AiIntent } from '../ai-contracts.types';

export interface ActionContractV5 {
  requiredEntities: string[];
  requiredTools: string[];
  completionCriteria: string[];
  fallbackOnFailure: string | null;
}

export const ROLE_ACTION_CONTRACTS: Record<
  string,
  Record<string, ActionContractV5>
> = {
  TENANT: {
    [AiIntent.EMERGENCY]: {
      requiredEntities: [],
      requiredTools: ['log_maintenance_issue'],
      completionCriteria: ['tool:log_maintenance_issue:success'],
      fallbackOnFailure: 'ask_unit_number',
    },
    [AiIntent.MAINTENANCE_REQUEST]: {
      requiredEntities: [],
      requiredTools: ['log_maintenance_issue'],
      completionCriteria: ['tool:log_maintenance_issue:success'],
      fallbackOnFailure: 'ask_unit_number',
    },
    [AiIntent.PAYMENT_PROMISE]: {
      requiredEntities: [],
      requiredTools: ['log_payment_promise'],
      completionCriteria: ['tool:log_payment_promise:success'],
      fallbackOnFailure: null,
    },
    [AiIntent.PAYMENT_DECLARATION]: {
      requiredEntities: ['tenantId'],
      requiredTools: ['record_payment'],
      completionCriteria: [
        'entity:tenantId:resolved',
        'tool:record_payment:success',
      ],
      fallbackOnFailure: 'clarify_tenant_identity',
    },
    [AiIntent.TENANT_COMPLAINT]: {
      requiredEntities: ['tenantId'],
      requiredTools: ['log_tenant_incident'],
      completionCriteria: [
        'entity:tenantId:resolved',
        'tool:log_tenant_incident:success',
      ],
      fallbackOnFailure: 'clarify_tenant_identity',
    },
  },
  COMPANY_STAFF: {
    [AiIntent.ONBOARDING]: {
      requiredEntities: ['propertyId'],
      requiredTools: ['onboard_property', 'add_tenant'],
      completionCriteria: [
        'tool:onboard_property:success',
        'tool:add_tenant:success',
      ],
      fallbackOnFailure: 'ask_property_details',
    },
    [AiIntent.FINANCIAL_REPORTING]: {
      requiredEntities: ['propertyId'],
      requiredTools: ['get_collection_rate'],
      completionCriteria: ['tool:get_collection_rate:success'],
      fallbackOnFailure: 'ask_property_name',
    },
    [AiIntent.FINANCIAL_QUERY]: {
      requiredEntities: ['propertyId'],
      requiredTools: ['get_revenue_summary', 'get_collection_rate'],
      completionCriteria: [
        'tool:get_revenue_summary:success',
        'tool:get_collection_rate:success',
      ],
      fallbackOnFailure: 'ask_property_name',
    },
  },
  LANDLORD: {
    [AiIntent.FINANCIAL_REPORTING]: {
      requiredEntities: ['propertyId'],
      requiredTools: ['get_revenue_summary'],
      completionCriteria: ['tool:get_revenue_summary:success'],
      fallbackOnFailure: 'ask_property_name',
    },
    [AiIntent.FINANCIAL_QUERY]: {
      requiredEntities: ['propertyId'],
      requiredTools: ['check_portfolio_vacancy'],
      completionCriteria: ['tool:check_portfolio_vacancy:success'],
      fallbackOnFailure: 'ask_property_name',
    },
  },
};

export const ACTION_CONTRACTS = ROLE_ACTION_CONTRACTS; // Backwards compatibility for now
