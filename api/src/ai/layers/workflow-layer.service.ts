import { Injectable, Logger } from '@nestjs/common';
import { WorkflowEngine } from '../../workflows/workflow.engine';
import {
  ActionContract,
  AiIntent,
  Interpretation,
  ExecutionTrace,
} from '../ai-contracts.types';
import {
  WorkflowInstance,
  WorkflowStatus,
} from '../../workflows/workflow.types';
import { findWorkflowByIntent } from '../../workflows/workflow.registry';

@Injectable()
export class WorkflowLayer {
  private readonly logger = new Logger(WorkflowLayer.name);

  constructor(private readonly workflowEngine: WorkflowEngine) {}

  async process(trace: ExecutionTrace): Promise<ExecutionTrace> {
    const { interpretation, actionContract, userId, sessionId } = trace;

    if (!interpretation || !actionContract) {
      this.logger.error(
        `[Workflow] Missing interpretation or contract in trace: ${trace.id}`,
      );
      trace.status = 'FAILED';
      trace.errors.push(
        'Missing interpretation or contract for workflow processing.',
      );
      return trace;
    }

    this.logger.log(
      `[Workflow] Processing state for intent: ${interpretation.intent}`,
    );
    trace.status = 'WORKFLOW_SYNC';

    // 1. Check for Active Instance
    let instance = await this.workflowEngine.getActiveInstance(userId);

    // 2. Resume logic (if applicable)
    if (instance && instance.status === 'WAITING') {
      this.logger.log(`[Workflow] Resuming instance: ${instance.instanceId}`);
      instance = await this.workflowEngine.resume(instance.instanceId, {
        type: 'USER_MESSAGE',
        content: interpretation.entities,
        meta: { message: interpretation.raw_reasoning },
      });
    } else if (!instance || instance.status === 'COMPLETED') {
      // 3. Trigger new workflow if none active or previous finished
      const definition = findWorkflowByIntent(
        interpretation.intent.toLowerCase(),
      );
      if (definition) {
        this.logger.log(
          `[Workflow] Triggering new workflow: ${definition.id} for intent: ${interpretation.intent}`,
        );
        instance = await this.workflowEngine.create(definition.id, userId, {
          chatId: sessionId,
          companyId: trace.metadata.companyId || 'SYSTEM',
          ...interpretation.entities,
        });
      }
    }

    if (instance) {
      trace.workflowState = {
        status: instance.status,
        currentStep: instance.currentState,
        data: instance.context,
      };

      // v4.5 "Fluid Spine": Hydrate trace metadata with IDs from workflow context
      // This ensures that downstream actions (e.g., assign_technician) have the required IDs
      trace.metadata.activeIssueId =
        instance.context.maintenanceId ||
        instance.context.issueId ||
        trace.metadata.activeIssueId;
      trace.metadata.activeTenantId =
        instance.context.tenantId || trace.metadata.activeTenantId;
      trace.metadata.activeUnitId =
        instance.context.unitId || trace.metadata.activeUnitId;
      trace.metadata.activePropertyId =
        instance.context.propertyId || trace.metadata.activePropertyId;

      // Integrity Check: If workflow is RUNNING but required context is still missing, we might have a problem
      if (
        instance.status === 'RUNNING' &&
        actionContract.requiresContext.some((c) => !instance.context[c])
      ) {
        this.logger.warn(
          `[Workflow] Trace ${trace.id} in RUNNING state but missing context fields: ${actionContract.requiresContext}`,
        );
      }
    } else {
      trace.workflowState = { status: 'COMPLETED' }; // Atomic action
    }

    return trace;
  }
}
