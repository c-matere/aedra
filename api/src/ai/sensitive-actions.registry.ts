export enum RiskTier {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface SensitiveAction {
  toolName: string;
  tier: RiskTier;
  quorumRequired: number;
  requireBiometric: boolean;
  description: string;
}

export const SENSITIVE_ACTIONS_REGISTRY: Record<string, SensitiveAction> = {
  delete_property: {
    toolName: 'delete_property',
    tier: RiskTier.HIGH,
    quorumRequired: 2,
    requireBiometric: true,
    description: 'Permanently deletes a property and all its units.',
  },
  delete_tenant: {
    toolName: 'delete_tenant',
    tier: RiskTier.MEDIUM,
    quorumRequired: 1,
    requireBiometric: true,
    description: 'Deletes a tenant record.',
  },
  update_landlord: {
    toolName: 'update_landlord',
    tier: RiskTier.HIGH,
    quorumRequired: 2,
    requireBiometric: true,
    description:
      'Updates landlord sensitive details including banking/payout info.',
  },
  bulk_generate_invoices: {
    toolName: 'bulk_generate_invoices',
    tier: RiskTier.MEDIUM,
    quorumRequired: 1,
    requireBiometric: false,
    description: 'Generates invoices for all active leases.',
  },
  send_rent_reminders: {
    toolName: 'send_rent_reminders',
    tier: RiskTier.LOW,
    quorumRequired: 0,
    requireBiometric: false,
    description: 'Sends bulk WhatsApp reminders to tenants.',
  },
  create_invoice: {
    toolName: 'create_invoice',
    tier: RiskTier.MEDIUM,
    quorumRequired: 1,
    requireBiometric: false,
    description: 'Generates a new invoice for a tenant.',
  },
  create_penalty: {
    toolName: 'create_penalty',
    tier: RiskTier.MEDIUM,
    quorumRequired: 1,
    requireBiometric: false,
    description: 'Charges a penalty/fine to a tenant.',
  },
  archive_tenant: {
    toolName: 'archive_tenant',
    tier: RiskTier.MEDIUM,
    quorumRequired: 1,
    requireBiometric: true,
    description: 'Archives a tenant record (soft delete).',
  },
  update_tenant: {
    toolName: 'update_tenant',
    tier: RiskTier.MEDIUM,
    quorumRequired: 1,
    requireBiometric: false,
    description: 'Updates tenant personal details.',
  },
  update_lease: {
    toolName: 'update_lease',
    tier: RiskTier.MEDIUM,
    quorumRequired: 1,
    requireBiometric: true,
    description: 'Updates lease terms (rent, dates, status).',
  },
  update_invoice: {
    toolName: 'update_invoice',
    tier: RiskTier.MEDIUM,
    quorumRequired: 1,
    requireBiometric: false,
    description: 'Updates invoice details or status.',
  },
  bulk_create_tenants: {
    toolName: 'bulk_create_tenants',
    tier: RiskTier.MEDIUM,
    quorumRequired: 1,
    requireBiometric: false,
    description: 'Creates multiple tenant records from a spreadsheet.',
  },
  record_arrears: {
    toolName: 'record_arrears',
    tier: RiskTier.MEDIUM,
    quorumRequired: 1,
    requireBiometric: false,
    description: 'Directly records debt/arrears for a tenant.',
  },
  update_staff_profile: {
    toolName: 'update_staff_profile',
    tier: RiskTier.HIGH,
    quorumRequired: 2,
    requireBiometric: true,
    description: 'Updates a staff member (User) record.',
  },
};
