import { ClassificationResult } from '../ai/ai-contracts.types';

export interface GuardResult {
  allowed: boolean;
  missingFields?: string[];
  reason?: string;
}

export const checkWorkflowGuard = (
  workflowId: string,
  classification: ClassificationResult,
): GuardResult => {
  const entities = classification.entities || {};

  switch (workflowId) {
    case 'maintenance_resolution':
    case 'report_maintenance': // Handle both triggers
      const missing = [];
      if (!entities.unit && !entities.unitNumber) missing.push('unitNumber');
      if (!entities.issue_details && !entities.description)
        missing.push('description');

      if (missing.length > 0) {
        return {
          allowed: false,
          missingFields: missing,
          reason: 'Missing required maintenance details (unit, description)',
        };
      }
      break;

    case 'rent_extension_request':
      const extMissing = [];
      if (!entities.proposed_date) extMissing.push('proposed_date');
      if (extMissing.length > 0) {
        return {
          allowed: false,
          missingFields: extMissing,
          reason: 'Need to know when you plan to pay.',
        };
      }
      break;

    case 'tenant_import':
      if (
        !classification.hasAttachments &&
        !entities.unit &&
        !entities.property_name
      ) {
        return {
          allowed: false,
          missingFields: ['data_source'],
          reason: 'No data source provided for tenant import',
        };
      }
      break;
  }

  return { allowed: true };
};
