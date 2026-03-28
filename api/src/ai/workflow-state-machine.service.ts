import { Injectable, Logger } from '@nestjs/common';
import { AiIntent } from './ai-contracts.types';

export enum WorkflowState {
  INIT = 'INIT',
  NEEDS_UNIT = 'NEEDS_UNIT',
  NEEDS_TENANT = 'NEEDS_TENANT',
  READY_TO_LOG = 'READY_TO_LOG',
  LOGGED = 'LOGGED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Injectable()
export class WorkflowStateMachineService {
  private readonly logger = new Logger(WorkflowStateMachineService.name);

  private readonly TRANSITIONS: Record<string, Record<string, WorkflowState>> = {
    [AiIntent.MAINTENANCE_REQUEST]: {
      'unit_missing': WorkflowState.NEEDS_UNIT,
      'unit_present': WorkflowState.READY_TO_LOG,
      'emergency': WorkflowState.READY_TO_LOG,
      'unit_provided': WorkflowState.READY_TO_LOG,
      'tool_success': WorkflowState.LOGGED,
      'notify_done': WorkflowState.COMPLETED,
    },
    [AiIntent.TENANT_COMPLAINT]: {
      'tenant_missing': WorkflowState.NEEDS_TENANT,
      'tenant_present': WorkflowState.READY_TO_LOG,
      'unit_present': WorkflowState.READY_TO_LOG,
      'tool_success': WorkflowState.LOGGED,
      'notify_done': WorkflowState.COMPLETED,
    },
    [AiIntent.FINANCIAL_QUERY]: {
      'tenant_missing': WorkflowState.NEEDS_TENANT,
      'tenant_present': WorkflowState.READY_TO_LOG,
      'unit_present': WorkflowState.READY_TO_LOG,
      'tool_success': WorkflowState.LOGGED,
    },
    [AiIntent.PAYMENT_PROMISE]: {
      'data_extracted': WorkflowState.READY_TO_LOG,
      'tool_success': WorkflowState.LOGGED,
      'notify_done': WorkflowState.COMPLETED,
    },
    [AiIntent.PAYMENT_DECLARATION]: {
      'tenant_missing': WorkflowState.NEEDS_TENANT,
      'tenant_present': WorkflowState.READY_TO_LOG,
      'unit_present': WorkflowState.READY_TO_LOG,
      'tool_success': WorkflowState.LOGGED,
      'notify_done': WorkflowState.COMPLETED,
    }
  };

  transition(intent: string, currentState: WorkflowState, event: string): WorkflowState {
    const next = this.TRANSITIONS[intent]?.[event];
    if (!next) {
      this.logger.warn(`[StateMachine] Invalid transition: intent=${intent}, state=${currentState}, event=${event}`);
      return currentState; // Stay in same state if invalid
    }
    this.logger.log(`[StateMachine] Transition: ${currentState} --(${event})--> ${next}`);
    return next;
  }
}
