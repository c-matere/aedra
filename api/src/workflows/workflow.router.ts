import { WorkflowEngine } from './workflow.engine';
import { findWorkflowByIntent } from './workflow.registry';
import { WorkflowInstance } from './workflow.types';

export interface RouteRequestOptions {
  userId: string;
  message: string;
  intent?: string;
  session?: any;
  directLookup?: (intent: string, context: any) => Promise<any>;
  agentFallback?: () => Promise<any>;
  context?: Record<string, any>;
}

/**
 * Canonical routing order:
 * 1) Resume active workflow for user.
 * 2) Start matched workflow by intent.
 * 3) Run direct lookup path if flagged.
 * 4) Fall back to agent pipeline.
 */
export const routeWorkflowRequest = async (
  engine: WorkflowEngine,
  opts: RouteRequestOptions,
): Promise<WorkflowInstance | any> => {
  const { userId, intent, context = {} } = opts;

  // Path 1 — resume active workflow
  const active = await engine.getActiveInstance(userId);
  if (active && active.status === 'WAITING') {
    console.log(
      `[WorkflowRouter] Resuming active workflow ${active.workflowId} for user ${userId}`,
    );
    return engine.resume(active.instanceId, {
      type: 'USER_MESSAGE',
      content: opts.message,
    });
  }

  // Path 2 — matched workflow by intent
  console.log(
    `[WorkflowRouter] Checking for workflow match with intent: ${intent}`,
  );
  const matched = findWorkflowByIntent(intent);
  if (matched) {
    console.log(
      `[WorkflowRouter] Starting NEW workflow ${matched.id} for intent ${intent}`,
    );
    return engine.create(matched.id, userId, context);
  }

  // Path 3 — direct lookup (simple retrieval, no workflow)
  if (opts.directLookup && intent === 'DIRECT_LOOKUP') {
    return opts.directLookup(intent, context);
  }

  // Path 4 — fallback to existing agent pipeline
  if (opts.agentFallback) {
    return opts.agentFallback();
  }

  return null;
};
