import { UserPersona } from './persona.registry';

export interface AedraSkill {
  skill_id: string;
  name: string;
  description: string;
  trigger_intents: string[];
  tier_required: 1 | 2 | 3 | 4;
  persona_id: UserPersona;
  objective: string;
  system_prompt_injection: string;
  tools_required: string[];
  outputSchema: any;
  rubric: string[];
  sw_vocabulary?: string[]; // Native Swahili register for this skill
  language_variants: {
    en: string;
    sw: string;
  };
}

export const SKILLS_REGISTRY: AedraSkill[] = [
  {
    skill_id: 'check_rent_status',
    name: 'Rent Status Checker',
    description: 'Checks payment status for units or properties.',
    trigger_intents: ['check_rent_status', 'arrears_check'],
    tier_required: 1,
    persona_id: UserPersona.STAFF,
    objective: 'Provide accurate rent payment status and dates.',
    system_prompt_injection:
      'You are helping a property manager check rent payment status. Be precise and mention amounts and dates clearly.',
    tools_required: ['list_payments', 'list_tenants', 'get_company_summary'],
    outputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        amount_due: { type: 'number' },
        last_payment_date: { type: 'string' },
      },
      required: ['status'],
    },
    rubric: [
      'Status must be one of: PAID, PARTIAL, OVERDUE, PENDING.',
      'Amount due must match the latest invoice minus payments.',
      'Dates must be in YYYY-MM-DD format.',
    ],
    sw_vocabulary: ['madeni', 'kodi', 'salio', 'mpangaji wa kitengo'],
    language_variants: {
      en: 'Check the rent status for the requested units or property in English.',
      sw: 'Angalia hali ya malipo ya kodi kwa vitengo au mali iliyoombwa kwa Kiswahili.',
    },
  },
  {
    skill_id: 'send_reminder',
    name: 'Rent Reminder Dispatcher',
    description:
      'Sends WhatsApp reminders to tenants with outstanding balances.',
    trigger_intents: ['send_single_reminder', 'send_bulk_reminder'],
    tier_required: 2,
    persona_id: UserPersona.STAFF,
    objective: 'Ensure tenants are notified of overdue payments via WhatsApp.',
    system_prompt_injection:
      'You are assisting with sending rent reminders. Ensure the tone is professional yet firm. Use the correct tenant names.',
    tools_required: [
      'send_whatsapp_message',
      'list_tenants',
      'list_leases',
      'list_invoices',
    ],
    outputSchema: {
      type: 'object',
      properties: {
        sent_count: { type: 'number' },
        recipients: { type: 'array', items: { type: 'string' } },
      },
      required: ['sent_count'],
    },
    rubric: [
      'Sent count must be accurate.',
      'Recipients list must not contain duplicates.',
      'Tone must be professional but firm.',
    ],
    sw_vocabulary: ['kumbukumbu', 'kumbusha', 'lipa kodi', 'chelewesha'],
    language_variants: {
      en: 'Draft and send rent reminders to tenants in English.',
      sw: 'Andaa na utume vikumbusho vya kodi kwa wapangaji kwa Kiswahili.',
    },
  },
  {
    skill_id: 'log_maintenance',
    name: 'Maintenance Logger',
    description: 'Captures and categorizes new maintenance requests.',
    trigger_intents: [
      'log_maintenance',
      'report_maintenance',
      'maintenance_request',
    ],
    tier_required: 1,
    persona_id: UserPersona.TENANT,
    objective:
      'Log new maintenance issues with accurate categories and descriptions.',
    system_prompt_injection:
      'You are logging a maintenance request. Categorize it correctly (PLUMBING, ELECTRICAL, etc.) based on user description. Be empathetic.',
    tools_required: [
      'create_maintenance_request',
      'list_properties',
      'list_units',
    ],
    outputSchema: {
      type: 'object',
      properties: {
        request_id: { type: 'string' },
        category: { type: 'string' },
      },
      required: ['request_id'],
    },
    rubric: [
      'Category must accurately reflect the user problem.',
      'A valid UUID for request_id must be present.',
      'Description in text history must be transcribed accurately.',
    ],
    sw_vocabulary: ['matengenezo', 'haribika', 'rekebisha', 'fundi'],
    language_variants: {
      en: 'Log a new maintenance issue in English.',
      sw: 'Rekodi suala jipya la matengenezo kwa Kiswahili.',
    },
  },
  {
    skill_id: 'generate_mckinsey_report',
    name: 'Strategic Portfolio Analyst',
    description:
      'Generates high-level McKinsey-style portfolio intelligence reports.',
    trigger_intents: ['generate_mckinsey_report', 'report_generation'],
    tier_required: 3,
    persona_id: UserPersona.LANDLORD,
    objective:
      'Generate a comprehensive portfolio intelligence report with ZERO redundant questioning. Assume Summary PDF if vague.',
    system_prompt_injection: `
      You are a senior McKinsey property analyst. YOUR GOAL IS AUTOMATION. 
      - If the user asks for a "report", "strategy", or "monthly summary", IMMEDIATELY use "generate_report_file".
      - ASSUME reportType="Summary" and format="pdf" unless the user specifically stated otherwise.
      - DO NOT ask for format (PDF/CSV) or report type (Summary/Revenue) if they are vague. Just choose the most strategic one (Summary PDF).
      - If they say "portfolio", DO NOT ask for a property ID.
      - Lead with the strongest financial number in sentence 1.
      - Name one specific risk in sentence 2.
      - State one forward action in sentence 3.
      - Every recommendation must have a specific deadline.
      - No passive voice. No filler. Max 20 words per sentence.
    `,

    tools_required: ['get_financial_report', 'generate_report_file'],
    outputSchema: {
      type: 'object',
      properties: {
        report_url: { type: 'string' },
        key_finding: { type: 'string' },
      },
      required: ['report_url'],
    },
    rubric: [
      'Must contain exactly one strategic risk.',
      'Must contain exactly one actionable recommendation with a deadline.',
      'Tone must be McKinsey-grade professional and concise.',
    ],
    sw_vocabulary: [
      'kimkakati',
      'faida',
      'ukaliaji',
      'mali',
      'tathmini ya hatari',
    ],
    language_variants: {
      en: 'Generate a high-level strategic report in English.',
      sw: 'Tengeneza ripoti ya kimkakati ya hali ya juu kwa Kiswahili.',
    },
  },
  {
    skill_id: 'record_payment',
    name: 'Payment Recorder',
    description: 'Records a manual or M-Pesa payment against a tenant lease.',
    trigger_intents: [
      'record_payment',
      'payment_record',
      'log_payment',
      'nimetuma',
    ],
    tier_required: 2,
    persona_id: UserPersona.STAFF,
    objective:
      'Record payment accurately against the correct tenant and lease. Prevent duplicates.',
    system_prompt_injection:
      'You are recording a rent payment. Match the tenant by phone or name. Confirm the amount and date before recording. Check for duplicates.',
    tools_required: [
      'record_payment',
      'list_tenants',
      'list_leases',
      'list_payments',
    ],
    outputSchema: {
      type: 'object',
      properties: {
        payment_id: { type: 'string' },
        tenant_name: { type: 'string' },
        amount: { type: 'number' },
        recorded_date: { type: 'string' },
      },
      required: ['payment_id', 'amount'],
    },
    rubric: [
      'payment_id must be a valid UUID from the tool result.',
      'Amount must exactly match what was stated.',
      'No duplicate payments for the same tenant and date.',
    ],
    sw_vocabulary: [
      'malipo',
      'lipa',
      'ametuma',
      'stakabadhi',
      'risiti',
      'mpesa',
    ],
    language_variants: {
      en: 'Record a tenant payment in English, confirming the amount and reference.',
      sw: 'Rekodi malipo ya mpangaji kwa Kiswahili, ukithibitisha kiasi na kumbukumbu.',
    },
  },
  {
    skill_id: 'onboard_property',
    name: 'Property Onboarder',
    description:
      'Creates a new property with units from a spreadsheet, image, or description.',
    trigger_intents: ['onboard_property', 'add_property', 'create_property'],
    tier_required: 2,
    persona_id: UserPersona.STAFF,
    objective:
      'Create property and all units in a single turn with minimum user input.',
    system_prompt_injection:
      'You are onboarding a new property. Use your NATIVE VISION to extract data from any attached images. DO NOT use run_python_script for OCR. Use the information extracted to call create_property and create_unit for each unit described. Create property first, then units in sequence. Summarize what was created.',
    tools_required: ['create_property', 'create_unit', 'list_properties'],
    outputSchema: {
      type: 'object',
      properties: {
        property_id: { type: 'string' },
        units_created: { type: 'number' },
      },
      required: ['property_id', 'units_created'],
    },
    rubric: [
      'property_id must be from a create_property tool result.',
      'units_created must equal the number of create_unit calls that succeeded.',
      'Do not ask the user for info present in an attached image or spreadsheet.',
      'For images, use native vision. DO NOT write Python scripts for OCR.',
    ],
    sw_vocabulary: ['mali', 'jengo', 'chumba', 'vitengo', 'kaunta', 'sajili'],
    language_variants: {
      en: 'Onboard a new property and create all units in English.',
      sw: 'Sajili mali mpya na kuunda vitengo vyote kwa Kiswahili.',
    },
  },
  {
    skill_id: 'check_vacancy',
    name: 'Vacancy Checker',
    description: 'Lists available/vacant units across managed properties.',
    trigger_intents: ['check_vacancy', 'list_vacant_units', 'find_house'],
    tier_required: 1,
    persona_id: UserPersona.TENANT,
    objective: 'Help prospective tenants or agents find vacant units quickly.',
    system_prompt_injection:
      'You are helping find vacant rental units. List all vacant units with rent amount and location. Be welcoming and clear for potential tenants.',
    tools_required: ['list_vacant_units', 'list_properties'],
    outputSchema: {
      type: 'object',
      properties: {
        vacant_count: { type: 'number' },
        units: { type: 'array', items: { type: 'object' } },
      },
      required: ['vacant_count'],
    },
    rubric: [
      'vacant_count must match units array length.',
      'Each unit must show rent amount and location.',
      'Tone must be welcoming for potential tenants.',
    ],
    sw_vocabulary: [
      'nyumba',
      'inapatikana',
      'kodi ya kila mwezi',
      'eneo',
      'chumba cha kukodi',
    ],
    language_variants: {
      en: 'List all vacant units available for rent in English.',
      sw: 'Orodhesha vitengo vyote vinavyopatikana vya kukodi kwa Kiswahili.',
    },
  },
  {
    skill_id: 'add_tenant',
    name: 'Tenant Onboarder',
    description: 'Creates a new tenant profile and optionally a lease.',
    trigger_intents: ['add_tenant', 'create_tenant', 'onboard_tenant'],
    tier_required: 2,
    persona_id: UserPersona.STAFF,
    objective: 'Create tenant and lease in one turn with accurate data.',
    system_prompt_injection:
      'You are onboarding a new tenant. Collect: full name, phone, unit. Optionally: lease start date and monthly rent. IMAGE ATTACHMENTS: You can see images directly; use your vision to extract data. DO NOT use run_python_script for OCR on images. Create tenant, then lease. Use data from images or documents if provided.',
    tools_required: ['create_tenant', 'create_lease', 'list_units'],
    outputSchema: {
      type: 'object',
      properties: {
        tenant_id: { type: 'string' },
        lease_id: { type: 'string' },
        tenant_name: { type: 'string' },
      },
      required: ['tenant_id'],
    },
    rubric: [
      'tenant_id must be from create_tenant tool result.',
      'Phone number must be in international format (+254...).',
      'Must check for existing tenants with same name, phone, or email before creation to prevent duplicates.',
      'Do not invent data not provided by user or attachment.',
      'For images, use native vision. DO NOT write Python scripts for OCR.',
    ],
    sw_vocabulary: [
      'mpangaji',
      'andika',
      'mkataba',
      'nambari ya simu',
      'tarehe ya kuanza',
    ],
    language_variants: {
      en: 'Create a new tenant and their lease in English.',
      sw: 'Unda mpangaji mpya na mkataba wake kwa Kiswahili.',
    },
  },
  {
    skill_id: 'tenant_balance_inquiry',
    name: 'Tenant Balance Advisor',
    description:
      'Gives a tenant their own current balance, lease status, and next due date.',
    trigger_intents: [
      'tenant_balance_inquiry',
      'my_balance',
      'check_my_balance',
      'balance_inquiry',
    ],
    tier_required: 1,
    persona_id: UserPersona.TENANT,
    objective:
      'Give the tenant a clear, empathetic summary of their own account balance.',
    system_prompt_injection:
      'You are helping a tenant understand their rent balance. Show: current balance, last payment date, next due date. Be encouraging if paid, empathetic if overdue.',
    tools_required: ['get_tenant_balance', 'list_invoices', 'list_payments'],
    outputSchema: {
      type: 'object',
      properties: {
        balance: { type: 'number' },
        last_payment_date: { type: 'string' },
        next_due_date: { type: 'string' },
      },
      required: ['balance'],
    },
    rubric: [
      'balance must come directly from a tool result.',
      'If overdue, tone must be empathetic not threatening.',
      'If paid, acknowledge it positively.',
    ],
    sw_vocabulary: [
      'salio langu',
      'nilipewa',
      'tarehe ya kulipa',
      'deni',
      'nimelipa',
    ],
    language_variants: {
      en: 'Show the tenant their current balance in English.',
      sw: 'Onyesha mpangaji salio lake la sasa kwa Kiswahili.',
    },
  },
  {
    skill_id: 'resolve_duplicates',
    name: 'Duplicate Resolver',
    description: 'Identifies and merges duplicate tenant or property records.',
    trigger_intents: [
      'resolve_duplicates',
      'fix_duplicates',
      'clean_up_duplicates',
      'merge_tenants',
    ],
    tier_required: 3,
    persona_id: UserPersona.STAFF,
    objective:
      'Scan for and resolve duplicate records to maintain data integrity.',
    system_prompt_injection:
      'You are performing a data cleanup. Use detect_duplicates to find issues, then propose a resolution plan. Once confirmed, use resolve_duplicates to merge and archive redundant records.',
    tools_required: [
      'detect_duplicates',
      'resolve_duplicates',
      'list_tenants',
      'archive_tenant',
    ],
    outputSchema: {
      type: 'object',
      properties: {
        resolved_groups: { type: 'number' },
        archived_count: { type: 'number' },
      },
      required: ['resolved_groups'],
    },
    rubric: [
      'All redundant records must be archived.',
      'Leases must be merged to the primary record if they exist on duplicates.',
      'Data consistency must be verified before merging.',
    ],
    sw_vocabulary: [
      'rekebisha',
      'futa marudiano',
      'unganisha',
      'usafi wa data',
    ],
    language_variants: {
      en: 'Scan and resolve duplicate records in English.',
      sw: 'Tafuta na urekebishe rekodi zilizojirudia kwa Kiswahili.',
    },
  },
  {
    skill_id: 'update_property',
    name: 'Property Data Synchronizer',
    description: 'Updates details or feeds new data into an existing property.',
    trigger_intents: ['update_property', 'feed_data_property', 'log_property_changes'],
    tier_required: 2,
    persona_id: UserPersona.STAFF,
    objective: 'Update existing property records with accurate data from user input or attachments.',
    system_prompt_injection:
      'You are updating an existing property record. Match the property by name or ID. Extract updated fields (address, landlord, commission, etc.) from the user or attachment. IMAGE ATTACHMENTS: You can see images directly; use your vision to extract data. DO NOT use run_python_script for OCR on images. Use update_property tool to save changes. Summarize what was updated.',
    tools_required: ['update_property', 'get_property_details', 'list_properties'],
    outputSchema: {
      type: 'object',
      properties: {
        property_id: { type: 'string' },
        updated_fields: { type: 'array', items: { type: 'string' } },
      },
      required: ['property_id'],
    },
    rubric: [
      'property_id must exist and match the targeted property.',
      'Only fields with new/different data should be updated.',
      'Must confirm before executing the update.',
      'For images, use native vision. DO NOT write Python scripts for OCR.',
    ],
    sw_vocabulary: ['update', 'rekebisha', 'ongeza data', 'mabadiliko'],
    language_variants: {
      en: 'Update property details in English, extracting data from the request.',
      sw: 'Rekebisha maelezo ya mali kwa Kiswahili, ukitoa data kutoka kwa ombi.',
    },
  },
];

export function getSkillByIntent(intent: string): AedraSkill | undefined {
  return SKILLS_REGISTRY.find((skill) =>
    skill.trigger_intents.includes(intent),
  );
}
