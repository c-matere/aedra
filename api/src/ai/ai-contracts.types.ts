export enum AiIntent {
  MAINTENANCE_REQUEST = 'MAINTENANCE_REQUEST',
  TENANT_COMPLAINT = 'TENANT_COMPLAINT',
  PAYMENT_PROMISE = 'PAYMENT_PROMISE',
  PAYMENT_DECLARATION = 'PAYMENT_DECLARATION',
  FINANCIAL_QUERY = 'FINANCIAL_QUERY',
  FINANCIAL_REPORTING = 'FINANCIAL_REPORTING',
  ONBOARDING = 'ONBOARDING',
  SYSTEM_FAILURE = 'SYSTEM_FAILURE',
  GENERAL_QUERY = 'GENERAL_QUERY',
  DISPUTE = 'DISPUTE',
  EMERGENCY = 'EMERGENCY',
  UTILITY_OUTAGE = 'UTILITY_OUTAGE',
  MAINTENANCE = 'MAINTENANCE',
  REVENUE_REPORT = 'REVENUE_REPORT',
  FINANCIAL_MANAGEMENT = 'FINANCIAL_MANAGEMENT',
  REGISTER_COMPANY = 'REGISTER_COMPANY',
}

export enum OperationalIntent {
  REASSURE_AND_ESCALATE = 'REASSURE_AND_ESCALATE',
  ACKNOWLEDGE_AND_POLICY = 'ACKNOWLEDGE_AND_POLICY',
  TECHNICAL_APOLOGY = 'TECHNICAL_APOLOGY',
  INVESTIGATE = 'INVESTIGATE',
  STANDARD = 'STANDARD',
}

export interface Interpretation {
  intent: AiIntent;
  operationalIntent: OperationalIntent;
  entities: {
    tenantName?: string;
    tenantId?: string;
    unitId?: string;
    propertyId?: string;
    issueId?: string;
    unitNumber?: string;
    amount?: number;
    date?: string;
    property_name?: string;
    issue_details?: string;
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
  };
  proposedValues?: {
    amount?: number;
    description?: string;
    unit?: string;
    isEmergency?: boolean;
    isUtilityOutage?: boolean;
  };
  confidence: number;
  language: 'en' | 'sw' | 'mixed';
  priority: 'NORMAL' | 'HIGH' | 'EMERGENCY';
  raw_reasoning?: string;
}

export interface UnifiedPlan {
  intent: AiIntent;
  priority: 'NORMAL' | 'HIGH' | 'EMERGENCY';
  language: 'en' | 'sw' | 'mixed';
  immediateResponse?: string; // shown before tools execute for EMERGENCY/URGENT
  entities: {
    tenantName?: string;    // raw string from LLM
    unitNumber?: string;    // raw string from LLM
    propertyName?: string;  // raw string from LLM
    amount?: number;
    date?: string;
    issueDescription?: string;
    tenantId?: string;      // pre-hydrated or resolved
    unitId?: string;        // pre-hydrated or resolved
    propertyId?: string;    // pre-hydrated or resolved
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
  };
  steps: Array<{
    tool: string;
    args: Record<string, any>;
    dependsOn?: string;     // tool name this step waits for
    required: boolean;      // if false, failure doesn't block rendering
    isHighStakes?: boolean;  // financial/maintenance steps
    claimedByPlan?: boolean; // did the LLM say it would complete this?
  }>;
  planReasoning?: string;    // for internal tracing/debugging
}

export interface VerifiedAction {
  tool: string;
  success: boolean;
  status: 'COMPLETE' | 'PARTIAL' | 'FAILED' | 'NOT_RUN';
  result?: any;           // raw tool output (only if success)
  errorMessage?: string;
  claimedByPlan?: boolean; // did the UnifiedPlan say this would happen?
}

export interface ActionContract {
  type: OperationalIntent;
  intent: AiIntent;
  requiredTools: string[];
  requiresContext: string[]; // e.g. ["tenantId", "unitId"]
  forbiddenActions: string[];
  actionPriority: 'DATA_FIRST' | 'ACK_FIRST' | 'SILENT' | 'IMMEDIATE' | 'RESOLVE_FIRST';
  elevationRequired?: boolean;
  outputSchema?: any;
  completionCriteria?: {
    mandatoryTools?: string[];
    requiredFields?: string[];
    allowPartial?: boolean;
  };
}

export interface TruthObject {
  computedAt: string;
  intent: AiIntent;
  operationalAction?: ActionContract;
  data: any;
  context: any;
  status: 'COMPLETE' | 'PARTIAL' | 'INSUFFICIENT_DATA' | 'CONFLICT' | 'ERROR' | 'AMBIGUOUS';
  actions?: VerifiedAction[];           // every step that ran
  missingRequirements?: string[];      // e.g. ["tenantId", "unitId"]
  immediateSafetyInstructions?: string; // for emergencies
}

export interface ExecutionStep {
  tool: string;
  args: any;
  result: any;
  success: boolean;
  required: boolean;
  timestamp: string;
}

export type TraceStatus = 
  | 'PENDING' 
  | 'INTERPRETING' 
  | 'DECIDING' 
  | 'POLICY_GATE' 
  | 'WORKFLOW_SYNC' 
  | 'EXECUTING' 
  | 'INTEGRITY_CHECK' 
  | 'RESOLVED' 
  | 'BLOCKED' 
  | 'FAILED';

export interface ExecutionTrace {
  id: string;
  sessionId: string;
  userId: string;
  role: string;
  input: string;
  status: TraceStatus;
  interpretation?: Interpretation;
  actionContract?: ActionContract;
  unifiedPlan?: UnifiedPlan;
  workflowState?: any;
  steps: ExecutionStep[];
  truth?: TruthObject;
  errors: string[];
  metadata: Record<string, any>;
  intentLock?: boolean; 
}

export interface GeneratedFile {
  url: string;
  fileName: string;
}

export interface UnifiedActionResult {
  success: boolean;
  action?: string;
  id?: string;
  data?: any;
  error?: string;
  summary?: string;
  metadata?: Record<string, any>;
}

export interface AiServiceChatResponse {
  response: string;
  chatId: string;
  metadata?: Record<string, any>;
  interactive?: any;
  vcSummary?: any;
  generatedFiles?: GeneratedFile[];
  requires_authorization?: boolean;
}
