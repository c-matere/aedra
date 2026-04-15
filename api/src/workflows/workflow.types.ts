export type WorkflowStepType = 'RULE' | 'TOOL' | 'AI' | 'WAIT';

export interface WorkflowStep {
  id: string;
  type: WorkflowStepType;
  description: string;
  allowedTools?: string[];
  metadata?: Record<string, any>;
}

export interface WorkflowDefinition {
  id: string;
  trigger_intents: string[];
  steps: WorkflowStep[];
  states: string[];
  initialState?: string;
}

export type WorkflowRegistry = Record<string, WorkflowDefinition>;

export type WorkflowStatus =
  | 'RUNNING'
  | 'WAITING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface AwaitingInput {
  question: string;
  expectedFormat: string;
  timeoutAt?: string;
}

export interface WorkflowInstance {
  instanceId: string;
  workflowId: string;
  userId: string;
  currentState: string;
  currentStepIndex: number;
  context: Record<string, any>;
  stagingJobId?: string;
  createdAt: string;
  updatedAt: string;
  completedSteps: string[];
  failedSteps: string[];
  awaitingInput?: AwaitingInput;
  status: WorkflowStatus;
}

export interface WorkflowEvent {
  type:
    | 'USER_MESSAGE'
    | 'SYSTEM_EVENT'
    | 'WEBHOOK'
    | 'BACKGROUND_HEARTBEAT'
    | 'INPUT';
  content?: any;
  meta?: Record<string, any>;
}

export type RouteResult =
  | {
      status: 'NEEDS_INFO';
      missingFields: string[];
      pendingIntent: string;
      collectedEntities: Record<string, any>;
      prompt?: string;
    }
  | {
      status: 'WORKFLOW_READY';
      workflowId: string;
      context: Record<string, any>;
    }
  | {
      status: 'DIRECT_RESPONSE';
      prompt: string;
      context?: Record<string, any>;
    }
  | {
      status: 'AGENT_FALLBACK';
      reason?: string;
    };

export interface RouteRequestOptions {
  userId: string;
  message: string;
  role?: string;
  intent?: string; // High-level intent from classifier
  classification?: any; // ClassificationResult to avoid circular deps if needed, but typed better in router
  session?: any;
  context?: Record<string, any>;
  agentFallback: (hint?: string) => Promise<any>;
}
