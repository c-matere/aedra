import { Injectable, Logger } from '@nestjs/common';
import { ContextMemoryService, LockedState } from './context-memory.service';

export interface WorkflowAction {
  type: 'TOOL' | 'MESSAGE' | 'CONDITION';
  name: string;
  args?: any;
  next?: string;
  onSuccess?: string;
  onFailure?: string;
}

export interface WorkflowState {
  name: string;
  description: string;
  action: WorkflowAction;
}

export interface WorkflowDefinition {
  intent: string;
  initialState: string;
  states: Record<string, WorkflowState>;
}

@Injectable()
export class AiStateWorkflowEngine {
  private readonly logger = new Logger(AiStateWorkflowEngine.name);

  private readonly workflows: Record<string, WorkflowDefinition> = {
    LATE_PAYMENT: {
      intent: 'LATE_PAYMENT',
      initialState: 'ACKNOWLEDGE',
      states: {
        ACKNOWLEDGE: {
          name: 'ACKNOWLEDGE',
          description: 'Acknowledge late payment notice and check arrears.',
          action: {
            type: 'MESSAGE',
            name: 'acknowledge_late_payment',
            next: 'CHECK_ARREARS'
          }
        },
        CHECK_ARREARS: {
          name: 'CHECK_ARREARS',
          description: 'Lookup current arrears for the tenant.',
          action: {
            type: 'TOOL',
            name: 'get_tenant_arrears',
            onSuccess: 'DECIDE_NOTIFICATION',
            onFailure: 'ERROR'
          }
        },
        DECIDE_NOTIFICATION: {
          name: 'DECIDE_NOTIFICATION',
          description: 'Check if notification is required based on arrears.',
          action: {
            type: 'CONDITION',
            name: 'has_arrears',
            onSuccess: 'AWAIT_APPROVAL',
            onFailure: 'CONFIRM_NO_ARREARS'
          }
        },
        AWAIT_APPROVAL: {
          name: 'AWAIT_APPROVAL',
          description: 'Ask staff if they want to notify the tenant.',
          action: {
            type: 'MESSAGE',
            name: 'ask_for_notification_approval',
            next: 'END' // Will be resumed on user "Yes/No"
          }
        },
        NOTIFY: {
          name: 'NOTIFY',
          description: 'Send notice to tenant.',
          action: {
            type: 'TOOL',
            name: 'send_notification',
            next: 'END'
          }
        },
        CONFIRM_NO_ARREARS: {
          name: 'CONFIRM_NO_ARREARS',
          description: 'Inform staff that no arrears were found.',
          action: {
            type: 'MESSAGE',
            name: 'confirm_clean_account',
            next: 'END'
          }
        },
        ERROR: {
          name: 'ERROR',
          description: 'Handle workflow failures.',
          action: {
            type: 'MESSAGE',
            name: 'workflow_error',
            next: 'END'
          }
        }
      }
    }
  };

  constructor(private readonly contextMemory: ContextMemoryService) {}

  async getNextStep(chatId: string, message: string): Promise<any> {
    const context = await this.contextMemory.getContext(chatId);
    const ls = context.lockedState;

    if (!ls?.lockedIntent || !this.workflows[ls.lockedIntent]) {
      return null; // Not a state-machine managed intent
    }

    const wf = this.workflows[ls.lockedIntent];
    const currentStateName = ls.activeIssueId || wf.initialState; // Using activeIssueId as current state pointer for now
    const currentState = wf.states[currentStateName];

    this.logger.log(`[WorkflowEngine] Intent=${ls.lockedIntent}, State=${currentStateName}`);

    return {
      intent: ls.lockedIntent,
      state: currentState,
      isComplete: currentStateName === 'END'
    };
  }

  async transition(chatId: string, nextState: string): Promise<void> {
    const context = await this.contextMemory.getContext(chatId);
    if (context.lockedState) {
      context.lockedState.activeIssueId = nextState;
      await this.contextMemory.setContext(chatId, context);
    }
  }
}
