import { WorkflowDefinition, WorkflowRegistry } from './workflow.types';

const tenantImport: WorkflowDefinition = {
    id: 'tenant_import',
    trigger_intents: ['onboard_property', 'add_multiple_tenants', 'tenant_import'],
    steps: [
        { id: 'parse_input', type: 'AI', description: 'Extract rows from spreadsheet/photo' },
        { id: 'infer_schema', type: 'AI', description: 'Map columns to known fields' },
        { id: 'validate_entities', type: 'RULE', description: 'Check required fields present' },
        { id: 'resolve_ambiguity', type: 'AI', description: 'Ask about missing/unclear data' },
        { id: 'create_properties', type: 'TOOL', description: 'Create property records if new' },
        { id: 'create_units', type: 'TOOL', description: 'Create unit records' },
        { id: 'create_tenants', type: 'TOOL', description: 'Create tenant records' },
        { id: 'assign_units', type: 'TOOL', description: 'Link tenants to units' },
        { id: 'set_balances', type: 'TOOL', description: 'Set opening balances' },
        { id: 'send_summary', type: 'AI', description: 'Natural language completion summary' },
    ],
    states: [
        'UPLOAD_RECEIVED', 'SCHEMA_INFERRED', 'VALIDATED',
        'AMBIGUITY_RESOLVED', 'ENTITIES_CREATED', 'COMPLETED', 'FAILED',
    ],
};

const rentCollection: WorkflowDefinition = {
    id: 'rent_collection_cycle',
    trigger_intents: ['start_collection', 'month_end_cycle', 'rent_collection_cycle'],
    steps: [
        { id: 'identify_unpaid', type: 'TOOL', description: 'Query unpaid tenants' },
        { id: 'segment_by_history', type: 'RULE', description: 'Classify by payment history' },
        { id: 'send_reminders', type: 'TOOL', description: 'Send tiered reminders' },
        { id: 'wait_for_payments', type: 'WAIT', description: 'Monitor incoming payments' },
        { id: 'reconcile', type: 'TOOL', description: 'Match payments to invoices' },
        { id: 'generate_report', type: 'TOOL', description: 'Build collection summary' },
        { id: 'notify_landlord', type: 'TOOL', description: 'Send report to landlord' },
    ],
    states: [
        'INITIATED', 'REMINDERS_SENT', 'COLLECTING',
        'RECONCILED', 'REPORTED', 'CLOSED',
    ],
};

const maintenanceResolution: WorkflowDefinition = {
    id: 'maintenance_resolution',
    trigger_intents: ['log_maintenance', 'report_maintenance', 'maintenance_resolution'],
    steps: [
        { id: 'receive_report', type: 'TOOL', description: 'Log ticket with media' },
        { id: 'classify_urgency', type: 'RULE', description: 'Emergency / Urgent / Routine' },
        { id: 'notify_agent', type: 'TOOL', description: 'Alert responsible agent' },
        { id: 'acknowledge_tenant', type: 'TOOL', description: 'Send reference number to tenant' },
        { id: 'assign_technician', type: 'TOOL', description: 'Agent assigns technician' },
        { id: 'track_resolution', type: 'WAIT', description: 'Monitor for completion' },
        { id: 'close_ticket', type: 'TOOL', description: 'Mark resolved' },
        { id: 'rate_resolution', type: 'TOOL', description: 'Request tenant rating' },
        { id: 'send_summary', type: 'AI', description: 'Natural language wrap-up' },
    ],
    states: [
        'REPORTED', 'CLASSIFIED', 'AGENT_NOTIFIED',
        'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'RATED', 'CLOSED',
    ],
};

const reportGeneration: WorkflowDefinition = {
    id: 'report_generation',
    trigger_intents: ['generate_mckinsey_report', 'request_report', 'report_generation'],
    steps: [
        { id: 'acknowledge', type: 'TOOL', description: 'Send ETA to agent' },
        { id: 'fetch_financials', type: 'TOOL', description: 'Stage payment + invoice data' },
        { id: 'fetch_occupancy', type: 'TOOL', description: 'Stage tenant heatmap' },
        { id: 'fetch_maintenance', type: 'TOOL', description: 'Stage maintenance summary' },
        { id: 'compute_summaries', type: 'RULE', description: 'Collection rate, yield, deltas' },
        { id: 'ai_analysis', type: 'AI', description: 'Pattern detection, risk flags' },
        { id: 'assemble_pdf', type: 'TOOL', description: 'Render and upload report' },
        { id: 'deliver_agent', type: 'TOOL', description: 'Send link to agent' },
        { id: 'suggest_landlord', type: 'TOOL', description: 'Offer to send to landlord' },
    ],
    states: [
        'INITIATED', 'DATA_STAGED', 'COMPUTED',
        'ANALYSED', 'ASSEMBLED', 'DELIVERED', 'LANDLORD_NOTIFIED',
    ],
};

const vacancyToLet: WorkflowDefinition = {
    id: 'vacancy_to_let',
    trigger_intents: ['list_on_homeet', 'fill_vacancy', 'vacancy_to_let'],
    steps: [
        { id: 'create_listing', type: 'TOOL', description: 'Add unit to Homeet map' },
        { id: 'receive_inquiry', type: 'WAIT', description: 'Prospect expresses interest' },
        { id: 'qualify_prospect', type: 'AI', description: 'Ask qualifying questions' },
        { id: 'book_viewing', type: 'TOOL', description: 'Schedule via agent calendar' },
        { id: 'notify_agent', type: 'TOOL', description: 'Push booking to agent WhatsApp' },
        { id: 'post_viewing', type: 'WAIT', description: 'Wait for agent outcome' },
        { id: 'convert_to_tenant', type: 'TOOL', description: 'Trigger tenant onboarding' },
        { id: 'close_listing', type: 'TOOL', description: 'Mark unit as occupied' },
    ],
    states: [
        'LISTED', 'INQUIRY_RECEIVED', 'QUALIFIED',
        'VIEWING_BOOKED', 'VIEWED', 'CONVERTED', 'CLOSED',
    ],
};

export const AEDRA_WORKFLOWS: WorkflowRegistry = {
    [tenantImport.id]: tenantImport,
    [rentCollection.id]: rentCollection,
    [maintenanceResolution.id]: maintenanceResolution,
    [reportGeneration.id]: reportGeneration,
    [vacancyToLet.id]: vacancyToLet,
};

export const triggerIntentIndex: Record<string, string> = Object.values(AEDRA_WORKFLOWS)
    .flatMap(wf => wf.trigger_intents.map(intent => ({ intent, id: wf.id })))
    .reduce((acc, curr) => ({ ...acc, [curr.intent]: curr.id }), {});

export const findWorkflowByIntent = (intent?: string): WorkflowDefinition | undefined => {
    if (!intent) return undefined;
    const workflowId = triggerIntentIndex[intent];
    return workflowId ? AEDRA_WORKFLOWS[workflowId] : undefined;
};
