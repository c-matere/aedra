import { AiPersona, UserPersona } from './persona.registry';
import { allToolDeclarations } from './ai.tools';

/**
 * INTENT_TOOL_MAP: Maps standardized classification intents to specific required tool names.
 */
export const INTENT_TOOL_MAP: Record<string, string[]> = {
  // --- SUPER ADMIN ---
  list_companies: ['list_companies'],
  select_company: ['list_companies', 'select_company'],
  switch_company: ['list_companies', 'select_company'],
  configure_whatsapp: ['configure_whatsapp', 'select_company'],

  // --- SHARED / PUBLIC ---
  check_vacancy: [
    'list_vacant_units',
    'get_unit_details',
    'get_property_details',
  ],
  register_company: ['register_company'],

  // --- OPERATIONAL (STAFF/LANDLORD) ---
  check_rent_status: [
    'get_portfolio_arrears',
    'list_payments',
    'list_invoices',
    'list_tenants',
  ],
  arrears_check: [
    'get_portfolio_arrears',
    'list_tenants',
    'send_whatsapp_message',
  ],
  tenant_balance_inquiry: [
    'list_tenants',
    'list_invoices',
    'list_payments',
    'get_tenant_details',
  ],
  get_tenant_details: [
    'search_tenants',
    'get_tenant_details',
    'list_leases',
    'list_invoices',
    'list_payments',
  ],

  log_maintenance: [
    'create_maintenance_request',
    'list_properties',
    'list_units',
    'search_tenants',
  ],
  maintenance_request: [
    'create_maintenance_request',
    'list_properties',
    'list_units',
    'search_tenants',
  ],
  report_maintenance: [
    'create_maintenance_request',
    'list_properties',
    'list_units',
    'search_tenants',
  ],
  maintenance_status: [
    'list_maintenance_requests',
    'update_maintenance_request',
    'get_unit_details',
  ],

  send_single_reminder: [
    'search_tenants',
    'send_whatsapp_message',
    'get_tenant_details',
  ],
  send_bulk_reminder: [
    'get_portfolio_arrears',
    'send_rent_reminders',
    'send_whatsapp_message',
  ],

  record_payment: [
    'search_tenants',
    'list_leases',
    'record_payment',
    'send_whatsapp_message',
    'list_tenants',
  ],
  log_payment: [
    'search_tenants',
    'list_leases',
    'record_payment',
    'send_whatsapp_message',
    'list_tenants',
  ],
  nimetuma: [
    'search_tenants',
    'list_leases',
    'record_payment',
    'send_whatsapp_message',
    'list_tenants',
  ],

  request_receipt: [
    'list_payments',
    'list_invoices',
    'send_whatsapp_message',
    'generate_report_file',
  ],
  add_tenant: [
    'create_tenant',
    'list_properties',
    'list_units',
    'create_lease',
  ],

  onboard_property: ['create_property', 'create_unit', 'create_landlord'],
  update_property: [
    'update_property',
    'get_property_details',
    'list_properties',
    'list_units',
    'search_tenants',
    'run_python_script',
  ],

  generate_mckinsey_report: [
    'list_properties',
    'get_property_details',
    'get_financial_report',
    'get_portfolio_arrears',
    'get_unit_details',
    'list_tenants',
    'generate_report_file',
    'send_report_landlord',
    'download_report',
    'schedule_report',
  ],
  report_generation: [
    'list_properties',
    'get_property_details',
    'get_financial_report',
    'get_portfolio_arrears',
    'list_tenants',
    'generate_report_file',
    'send_report_landlord',
    'download_report',
    'schedule_report',
  ],
  yield_analysis: [
    'get_company_summary',
    'get_financial_report',
    'generate_report_file',
    'list_properties',
  ],

  collection_status: [
    'get_company_summary',
    'get_portfolio_arrears',
    'get_financial_report',
  ],

  workflow_initiate: [
    'workflow_initiate',
    'generate_execution_plan',
    'list_leases',
    'list_maintenance_requests',
  ],

  // --- DIRECT TOOL MAPPINGS ---
  create_tenant: [
    'create_tenant',
    'list_properties',
    'list_units',
    'create_lease',
  ],
  create_property: ['create_property', 'create_unit', 'create_landlord'],
  create_unit: ['create_unit', 'list_properties'],
  create_lease: ['create_lease', 'list_units', 'list_tenants'],
  list_units: [
    'list_units',
    'get_unit_details',
    'search_units',
    'list_properties',
  ],
  list_leases: [
    'list_leases',
    'get_lease_details',
    'list_tenants',
    'list_units',
  ],
  list_payments: [
    'list_payments',
    'record_payment',
    'list_leases',
    'list_tenants',
  ],
  list_invoices: [
    'list_invoices',
    'create_invoice',
    'list_leases',
    'list_tenants',
  ],
  list_maintenance: [
    'list_maintenance_requests',
    'update_maintenance_request',
    'create_maintenance_request',
  ],
  generate_report: [
    'generate_report_file',
    'get_financial_report',
    'get_portfolio_arrears',
  ],
  import_tenants: [
    'run_python_script',
    'bulk_create_tenants',
    'list_properties',
    'create_tenant',
  ],
  bulk_create_tenants: [
    'run_python_script',
    'bulk_create_tenants',
    'list_properties',
  ],
  run_python_script: ['run_python_script', 'bulk_create_tenants'],
  general_query: [
    'list_properties',
    'list_tenants',
    'list_units',
    'get_company_summary',
    'get_portfolio_arrears',
    'run_python_script',
  ],
  emergency_escalation: [
    'create_maintenance_request',
    'list_maintenance_requests',
    'search_tenants',
    'list_units',
    'get_unit_details',
    'get_property_details',
  ],
  system_failure: [
    'list_maintenance_requests',
    'get_company_summary',
    'get_portfolio_arrears',
    'run_python_script',
  ],
};

/**
 * DEFAULT_TOOLS_BY_ROLE: A safe set of general-purpose tools to load when intent is unknown or general.
 */
export const DEFAULT_TOOLS_BY_ROLE: Record<UserPersona, string[]> = {
  [UserPersona.TENANT]: [
    'list_vacant_units',
    'list_maintenance_requests',
    'create_maintenance_request',
    'get_unit_details',
    'list_invoices',
    'list_payments',
  ],
  [UserPersona.LANDLORD]: [
    'list_properties',
    'get_property_details',
    'list_tenants',
    'get_portfolio_arrears',
    'get_company_summary',
    'generate_report_file',
    'select_company',
  ],
  [UserPersona.STAFF]: [
    'list_properties',
    'get_property_details',
    'search_properties',
    'list_units',
    'get_unit_details',
    'search_units',
    'list_tenants',
    'get_tenant_details',
    'search_tenants',
    'list_leases',
    'get_lease_details',
    'list_payments',
    'list_invoices',
    'list_expenses',
    'list_maintenance_requests',
    'create_maintenance_request',
    'get_portfolio_arrears',
    'get_company_summary',
    'record_payment',
    'select_company',
    'generate_execution_plan',
    'generate_report_file',
    'create_tenant',
    'create_property',
    'create_unit',
    'create_lease',
    'create_landlord',
    'run_python_script',
    'bulk_create_tenants',
    'update_tenant',
    'update_property',
    'update_unit',
    'update_lease',
    'record_arrears',
  ],
  [UserPersona.SUPER_ADMIN]: [
    'list_companies',
    'search_companies',
    'select_company',
    'register_company',
    'configure_whatsapp',
    'list_properties',
    'get_property_details',
    'search_properties',
    'list_units',
    'get_unit_details',
    'search_units',
    'list_tenants',
    'get_tenant_details',
    'search_tenants',
    'list_leases',
    'get_lease_details',
    'list_payments',
    'list_invoices',
    'list_expenses',
    'list_maintenance_requests',
    'create_maintenance_request',
    'get_portfolio_arrears',
    'get_company_summary',
    'record_payment',
    'select_company',
    'generate_execution_plan',
    'generate_report_file',
    'create_tenant',
    'create_property',
    'create_unit',
    'create_lease',
    'create_landlord',
    'create_staff',
    'update_staff_profile',
    'run_python_script',
    'bulk_create_tenants',
    'update_tenant',
    'update_property',
    'update_unit',
    'update_lease',
    'update_invoice',
    'record_arrears',
  ],
};

/**
 * ConversationContext: Structured context for tool selection.
 */
export interface ConversationContext {
  activeWorkflow?: string;
  lastEntityType?:
    | 'tenant'
    | 'property'
    | 'unit'
    | 'company'
    | 'payment'
    | 'maintenance'
    | 'report';
  lastToolName?: string;
  userId?: string;
  companyId?: string;
  propertyId?: string;
  lastEntityId?: string;
  role?: string;
  phone?: string;
  requestId?: string;
  maintenanceId?: string;
  unitId?: string;
  tenantId?: string;
}

/**
 * Standardizes the session UID for context-aware storage.
 */
export function getSessionUid(
  context: { userId?: string; phone?: string } | any,
): string {
  const isUnidentified = context?.userId === 'unidentified' || !context?.userId;
  return isUnidentified ? context?.phone || 'anon' : context.userId;
}

/**
 * ENTITY_STICKY_TOOLS: Tools that should remain available if the last interaction involved a specific entity.
 */
export const ENTITY_STICKY_TOOLS: Record<string, string[]> = {
  tenant: [
    'get_tenant_details',
    'record_payment',
    'send_whatsapp_message',
    'list_leases',
    'list_invoices',
    'run_python_script',
  ],
  property: [
    'get_property_details',
    'list_units',
    'list_tenants',
    'get_company_summary',
    'run_python_script',
  ],
  unit: [
    'get_unit_details',
    'update_unit_status',
    'create_lease',
    'list_maintenance_requests',
  ],
  company: ['get_company_summary', 'list_properties', 'select_company'],
  payment: ['list_payments', 'record_payment', 'send_whatsapp_message'],
  maintenance: [
    'list_maintenance_requests',
    'update_maintenance_request',
    'create_maintenance_request',
  ],
};

/**
 * TOOL_ENTITY_MAP: Maps specific tool names to the primary entity they manipulate.
 */
export const TOOL_ENTITY_MAP: Record<
  string,
  ConversationContext['lastEntityType']
> = {
  search_tenants: 'tenant',
  get_tenant_details: 'tenant',
  record_payment: 'payment',
  list_payments: 'payment',
  get_portfolio_arrears: 'report',
  get_financial_report: 'report',
  list_invoices: 'payment',
  list_properties: 'property',
  get_property_details: 'property',

  search_companies: 'company',
  list_companies: 'company',
  get_company_summary: 'report',
  generate_report_file: 'report',
  create_maintenance_request: 'maintenance',
  list_maintenance_requests: 'maintenance',
  create_tenant: 'tenant',
  delete_tenant: 'tenant',
  create_property: 'property',
  create_lease: 'unit',
  select_company: 'company',
};

/**
 * selectTools
 * Prunes the full tool manifest down to a relevant subset based on intent, persona, and context.
 */
export function selectTools(
  intent: string,
  persona: AiPersona,
  allTools: any[],
  context?: ConversationContext,
): any[] {
  const baseSet = ['list_properties', 'select_company', 'get_company_summary'];
  const intentToolNames =
    INTENT_TOOL_MAP[intent] || DEFAULT_TOOLS_BY_ROLE[persona.id] || [];

  // Combine base set with intent-specific tools
  const combinedTools = new Set([...baseSet, ...intentToolNames]);

  // Add context-aware sticky tools
  const contextTools: string[] = [];

  // 1. If we have an active workflow in context, ensure workflow tools are available
  if (context?.activeWorkflow) {
    contextTools.push('workflow_initiate', 'generate_execution_plan');
  }

  // 2. Approach 2: Entity Persistence (Sticky Tools)
  if (context?.lastEntityType && ENTITY_STICKY_TOOLS[context.lastEntityType]) {
    contextTools.push(...ENTITY_STICKY_TOOLS[context.lastEntityType]);
  }

  // 3. Fallback for "Search -> Act" patterns
  // If we just searched for something, the model might need to act on it in the next turn
  if (
    context?.lastToolName?.startsWith('search_') ||
    context?.lastToolName?.startsWith('list_')
  ) {
    contextTools.push(
      'get_tenant_details',
      'get_property_details',
      'get_unit_details',
      'get_lease_details',
    );
  }

  // 4. Boost for common operational intents if not already present
  if (intent.includes('maintenance') || intent.includes('emergency')) {
    contextTools.push(
      'create_maintenance_request',
      'list_maintenance_requests',
      'search_tenants',
    );
  }
  if (intent.includes('payment') || intent.includes('rent')) {
    contextTools.push(
      'record_payment',
      'list_payments',
      'get_portfolio_arrears',
    );
  }

  const requiredNames = new Set([...combinedTools, ...contextTools]);

  // 5. Global Operational Set for Staff/Admin to prevent "I can't do that" for basic lookups
  if (
    persona.id === UserPersona.STAFF ||
    persona.id === UserPersona.SUPER_ADMIN
  ) {
    const globalOperationalSet = [
      'list_properties',
      'get_property_details',
      'list_tenants',
      'get_tenant_details',
      'list_units',
      'get_unit_details',
      'get_company_summary',
      'get_portfolio_arrears',
      'create_property',
      'create_unit',
      'create_tenant',
      'create_lease',
      'update_property',
      'update_unit',
      'update_tenant',
      'update_lease',
      'update_invoice',
      'record_arrears',
    ];
    globalOperationalSet.forEach((t) => requiredNames.add(t));
  }

  // Filter the full manifest by the required names AND the persona's allowed tools (Hard Wall)
  const personaAllowed = new Set(persona.allowedTools);

  return allTools.filter(
    (t) => requiredNames.has(t.name) && personaAllowed.has(t.name),
  );
}
