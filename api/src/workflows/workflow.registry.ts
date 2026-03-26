import { WorkflowDefinition, WorkflowRegistry } from './workflow.types';

const tenantImport: WorkflowDefinition = {
  id: 'tenant_import',
  trigger_intents: [
    'onboard_property',
    'add_multiple_tenants',
    'tenant_import',
  ],
  steps: [
    {
      id: 'parse_input',
      type: 'AI',
      description: 'Extract rows from spreadsheet/photo',
      allowedTools: ['run_python_script', 'get_property_details'],
    },
    {
      id: 'infer_schema',
      type: 'AI',
      description: 'Map columns to known fields',
      allowedTools: ['run_python_script'],
    },
    {
      id: 'validate_entities',
      type: 'RULE',
      description: 'Check required fields present',
    },
    {
      id: 'resolve_ambiguity',
      type: 'AI',
      description: 'Ask about missing/unclear data',
      allowedTools: ['send_whatsapp_message', 'search_tenants', 'search_properties'],
    },
    {
      id: 'create_properties',
      type: 'TOOL',
      description: 'Create property records if new',
      allowedTools: ['create_property', 'get_property_details'],
    },
    {
      id: 'create_units',
      type: 'TOOL',
      description: 'Create unit records',
      allowedTools: ['create_unit', 'list_units'],
    },
    {
      id: 'create_tenants',
      type: 'TOOL',
      description: 'Create tenant records',
      allowedTools: ['create_tenant', 'search_tenants', 'bulk_create_tenants'],
    },
    {
      id: 'assign_units',
      type: 'TOOL',
      description: 'Link tenants to units',
      allowedTools: ['create_lease', 'update_unit'],
    },
    {
      id: 'set_balances',
      type: 'TOOL',
      description: 'Set opening balances',
      allowedTools: ['record_arrears', 'create_invoice'],
    },
    {
      id: 'send_summary',
      type: 'AI',
      description: 'Natural language completion summary',
      allowedTools: ['send_whatsapp_message'],
    },
  ],
  states: [
    'UPLOAD_RECEIVED', // Initial
    'PARSING', // parse_input completed
    'SCHEMA_INFERRED', // infer_schema completed
    'VALIDATED', // validate_entities completed
    'AMBIGUITY_RESOLVED', // resolve_ambiguity completed
    'PROPERTIES_CREATED', // create_properties completed
    'UNITS_CREATED', // create_units completed
    'TENANTS_CREATED', // create_tenants completed
    'LEASES_ASSIGNED', // assign_units completed
    'BALANCES_SET', // set_balances completed
    'COMPLETED', // send_summary completed
  ],
};

const rentCollection: WorkflowDefinition = {
  id: 'rent_collection_cycle',
  trigger_intents: [
    'start_collection',
    'month_end_cycle',
    'rent_collection_cycle',
  ],
  steps: [
    {
      id: 'identify_unpaid',
      type: 'TOOL',
      description: 'Query unpaid tenants',
      allowedTools: ['get_portfolio_arrears', 'list_tenants', 'list_invoices'],
    },
    {
      id: 'segment_by_history',
      type: 'RULE',
      description: 'Classify by payment history',
      allowedTools: ['get_tenant_details', 'list_payments'],
    },
    {
      id: 'send_reminders',
      type: 'TOOL',
      description: 'Send tiered reminders',
      allowedTools: ['send_rent_reminders', 'send_whatsapp_message'],
    },
    {
      id: 'wait_for_payments',
      type: 'WAIT',
      description: 'Monitor incoming payments',
      allowedTools: ['list_payments', 'get_portfolio_arrears'],
    },
    {
      id: 'reconcile',
      type: 'TOOL',
      description: 'Match payments to invoices',
      allowedTools: ['record_payment', 'update_invoice'],
    },
    {
      id: 'generate_report',
      type: 'TOOL',
      description: 'Build collection summary',
      allowedTools: ['generate_report_file', 'get_financial_summary'],
    },
    {
      id: 'notify_landlord',
      type: 'TOOL',
      description: 'Send report to landlord',
      allowedTools: ['send_report_landlord', 'send_whatsapp_message'],
    },
  ],
  states: [
    'INITIATED', // 0
    'UNPAID_IDENTIFIED', // 1
    'SEGMENTED', // 2
    'REMINDERS_SENT', // 3
    'COLLECTING', // 4 (WAIT)
    'RECONCILED', // 5
    'REPORT_GENERATED', // 6
    'CLOSED', // 7
  ],
};

const maintenanceResolution: WorkflowDefinition = {
  id: 'maintenance_resolution',
  trigger_intents: [
    'log_maintenance',
    'report_maintenance',
    'maintenance_request',
    'maintenance_resolution',
  ],
  steps: [
    {
      id: 'receive_report',
      type: 'TOOL',
      description: 'Log ticket with media',
      allowedTools: ['create_maintenance_request', 'get_property_details', 'get_tenant_details'],
    },
    {
      id: 'classify_urgency',
      type: 'RULE',
      description: 'Emergency / Urgent / Routine',
    },
    {
      id: 'notify_agent',
      type: 'TOOL',
      description: 'Alert responsible agent',
      allowedTools: ['send_whatsapp_message'],
    },
    {
      id: 'acknowledge_tenant',
      type: 'TOOL',
      description: 'Send reference number to tenant',
      allowedTools: ['send_whatsapp_message'],
    },
    {
      id: 'assign_technician',
      type: 'TOOL',
      description: 'Agent assigns technician',
      allowedTools: ['update_maintenance_request', 'list_staff'],
    },
    {
      id: 'track_resolution',
      type: 'WAIT',
      description: 'Monitor for completion',
      allowedTools: ['get_maintenance_request', 'send_whatsapp_message', 'list_maintenance_requests'],
    },
    { id: 'close_ticket', type: 'TOOL', description: 'Mark resolved', allowedTools: ['update_maintenance_request'] },
    {
      id: 'rate_resolution',
      type: 'TOOL',
      description: 'Request tenant rating',
      allowedTools: ['send_whatsapp_message'],
    },
    { id: 'send_summary', type: 'AI', description: 'Natural language wrap-up' },
  ],
  states: [
    'REPORTED', // 0
    'RECEIPT_LOGGED', // 1
    'CLASSIFIED', // 2
    'AGENT_NOTIFIED', // 3
    'TENANT_ACKED', // 4
    'ASSIGNED', // 5
    'IN_PROGRESS', // 6 (WAIT)
    'RESOLVED', // 7
    'RATED', // 8
    'CLOSED', // 9
  ],
};

const reportGeneration: WorkflowDefinition = {
  id: 'report_generation',
  trigger_intents: [
    'generate_mckinsey_report',
    'request_report',
    'report_generation',
  ],
  steps: [
    { id: 'acknowledge', type: 'TOOL', description: 'Send ETA to agent', allowedTools: ['send_whatsapp_message'] },
    {
      id: 'fetch_financials',
      type: 'TOOL',
      description: 'Stage payment + invoice data',
      allowedTools: ['get_financial_summary', 'list_payments', 'list_invoices'],
    },
    {
      id: 'fetch_occupancy',
      type: 'TOOL',
      description: 'Stage tenant heatmap',
      allowedTools: ['get_company_summary', 'list_tenants', 'list_units'],
    },
    {
      id: 'fetch_maintenance',
      type: 'TOOL',
      description: 'Stage maintenance summary',
      allowedTools: ['list_maintenance_requests'],
    },
    {
      id: 'compute_summaries',
      type: 'RULE',
      description: 'Collection rate, yield, deltas',
      allowedTools: ['get_financial_summary'],
    },
    {
      id: 'ai_analysis',
      type: 'AI',
      description: 'Pattern detection, risk flags',
      allowedTools: ['generate_report_file'],
    },
    {
      id: 'assemble_pdf',
      type: 'TOOL',
      description: 'Render and upload report',
      allowedTools: ['generate_report_file', 'download_report'],
    },
    { id: 'deliver_agent', type: 'TOOL', description: 'Send link to agent', allowedTools: ['send_whatsapp_message'] },
    {
      id: 'suggest_landlord',
      type: 'TOOL',
      description: 'Offer to send to landlord',
      allowedTools: ['send_whatsapp_message', 'send_report_landlord'],
    },
  ],
  states: [
    'INITIATED', // 0
    'ACKNOWLEDGED', // 1
    'FINANCIALS_STAGED', // 2
    'OCCUPANCY_STAGED', // 3
    'MAINTENANCE_STAGED', // 4
    'COMPUTED', // 5
    'ANALYSED', // 6
    'ASSEMBLED', // 7
    'DELIVERED', // 8
    'COMPLETED', // 9
  ],
};

const csvReportGeneration: WorkflowDefinition = {
  id: 'csv_report_generation',
  trigger_intents: ['generate_csv_report', 'csv_report_generation'],
  steps: [
    { id: 'acknowledge', type: 'TOOL', description: 'Confirm CSV request' },
    {
      id: 'fetch_financials',
      type: 'TOOL',
      description: 'Fetch payment and expense data',
    },
    {
      id: 'fetch_occupancy',
      type: 'TOOL',
      description: 'Fetch unit and tenant data',
    },
    {
      id: 'fetch_maintenance',
      type: 'TOOL',
      description: 'Fetch maintenance logs',
    },
    {
      id: 'assemble_csv',
      type: 'TOOL',
      description: 'Generate CSV file from data',
    },
    {
      id: 'format_delivery',
      type: 'RULE',
      description: 'Format the report link into a friendly message',
    },
    {
      id: 'deliver_csv',
      type: 'TOOL',
      description: 'Send download link to agent',
    },
  ],
  states: [
    'INITIATED',
    'COLLECTING_DATA',
    'ASSEMBLING',
    'DELIVERED',
    'COMPLETED',
  ],
};

const autonomousAgent: WorkflowDefinition = {
  id: 'autonomous_agent',
  trigger_intents: ['autonomous_agent', 'long_running_task', 'process_bulk'],
  steps: [
    {
      id: 'analyze_goal',
      type: 'AI',
      description: 'Analyze complex request and create an execution plan',
    },
    {
      id: 'notify_plan',
      type: 'TOOL',
      description: 'Send plan to user for approval',
    },
    {
      id: 'wait_for_approval',
      type: 'WAIT',
      description: 'Wait for user to approve or give feedback',
    },
    {
      id: 'process_feedback',
      type: 'AI',
      description: 'Adjust plan based on user notes',
    },
    {
      id: 'execute_next_chunk',
      type: 'TOOL',
      description: 'Perform a single chunk of work',
    },
    {
      id: 'evaluate_progress',
      type: 'AI',
      description: 'Check if goal is met and update remaining tasks',
    },
    {
      id: 'send_heartbeat',
      type: 'TOOL',
      description: 'Notify user of progress',
    },
    {
      id: 'wait_for_heartbeat',
      type: 'WAIT',
      description: 'Pause until next background cycle',
    },
  ],
  states: [
    'PLANNING',
    'EXECUTING',
    'EVALUATING',
    'STAKEHOLDER_NOTIFIED',
    'PAUSED',
    'COMPLETED',
  ],
};

const vacancyToLet: WorkflowDefinition = {
  id: 'vacancy_to_let',
  trigger_intents: ['list_on_homeet', 'fill_vacancy', 'vacancy_to_let'],
  steps: [
    {
      id: 'create_listing',
      type: 'TOOL',
      description: 'Add unit to Homeet map',
      allowedTools: ['update_unit_status', 'get_unit_details'],
    },
    {
      id: 'receive_inquiry',
      type: 'WAIT',
      description: 'Prospect expresses interest',
      allowedTools: ['send_whatsapp_message'],
    },
    {
      id: 'qualify_prospect',
      type: 'AI',
      description: 'Ask qualifying questions',
      allowedTools: ['send_whatsapp_message'],
    },
    {
      id: 'book_viewing',
      type: 'TOOL',
      description: 'Schedule via agent calendar',
      allowedTools: ['send_whatsapp_message', 'list_staff'],
    },
    {
      id: 'notify_agent',
      type: 'TOOL',
      description: 'Push booking to agent WhatsApp',
      allowedTools: ['send_whatsapp_message'],
    },
    { id: 'post_viewing', type: 'WAIT', description: 'Wait for agent outcome', allowedTools: ['send_whatsapp_message'] },
    {
      id: 'convert_to_tenant',
      type: 'TOOL',
      description: 'Trigger tenant onboarding',
      allowedTools: ['create_tenant', 'create_lease'],
    },
    { id: 'close_listing', type: 'TOOL', description: 'Mark unit as occupied', allowedTools: ['update_unit_status'] },
  ],
  states: [
    'LISTED', // 0
    'LISTING_CREATED', // 1
    'INQUIRY_RECEIVED', // 2 (WAIT)
    'QUALIFIED', // 3
    'VIEWING_BOOKED', // 4
    'AGENT_NOTIFIED', // 5
    'VIEWED', // 6 (WAIT)
    'CONVERTED', // 7
    'CLOSED', // 8
  ],
};

export const AEDRA_WORKFLOWS: WorkflowRegistry = {
  [tenantImport.id]: tenantImport,
  [rentCollection.id]: rentCollection,
  [maintenanceResolution.id]: maintenanceResolution,
  [reportGeneration.id]: reportGeneration,
  [vacancyToLet.id]: vacancyToLet,
  [autonomousAgent.id]: autonomousAgent,
};

export const triggerIntentIndex: Record<string, string> = Object.values(
  AEDRA_WORKFLOWS,
)
  .flatMap((wf) => wf.trigger_intents.map((intent) => ({ intent, id: wf.id })))
  .reduce((acc, curr) => ({ ...acc, [curr.intent]: curr.id }), {});

export const findWorkflowByIntent = (
  intent?: string,
): WorkflowDefinition | undefined => {
  if (!intent) return undefined;
  const workflowId = triggerIntentIndex[intent];
  return workflowId ? AEDRA_WORKFLOWS[workflowId] : undefined;
};
