export type WorkflowStepType = 'RULE' | 'TOOL' | 'AI' | 'WAIT';

export interface WorkflowStep {
    id: string;
    type: WorkflowStepType;
    description: string;
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

export type WorkflowStatus = 'RUNNING' | 'WAITING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

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
    type: 'USER_MESSAGE' | 'SYSTEM_EVENT' | 'WEBHOOK';
    content?: any;
    meta?: Record<string, any>;
}
