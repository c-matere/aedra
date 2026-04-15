import { Logger } from '@nestjs/common';
import { WorkflowEngine } from './workflow.engine';
import { findWorkflowByIntent } from './workflow.registry';
import { RouteResult, RouteRequestOptions } from './workflow.types';
import { ClassificationResult } from '../ai/ai-classifier.service';
import { checkWorkflowGuard } from './workflow.guard';

const routerLogger = new Logger('WorkflowRouter');

/**
 * Exhaustive Intent Router & Information Gate
 */
export const routeWorkflowRequest = async (
  engine: WorkflowEngine,
  opts: RouteRequestOptions,
): Promise<RouteResult | any> => {
  const { userId, intent, classification, context = {} } = opts;
  const message = opts.message || '';
  const workflowsEnabled =
    Boolean((context as any)?.phone) ||
    Boolean((context as any)?.allowWorkflows);

  routerLogger.log(`[RouterInput] intent="${intent}"`);

  // 1. Check for Active Continuity (Highest Priority)
  const active = await engine.getActiveInstance(userId);
  if (active && active.status === 'WAITING' && workflowsEnabled) {
    const looksLikeContinuation = (text: string): boolean => {
      const t = (text || '').trim().toLowerCase();
      return (
        /^(ok|okay|sure|yes|y|no|done|sent|confirm|confirmed|approve|approved|continue|proceed|go ahead|sawa|ndio|hapana|nimetuma|nimelipa)$/i.test(
          t,
        ) || /[A-Z0-9]{8,12}/.test(text)
      );
    };

    const matchedNew = intent ? findWorkflowByIntent(intent) : undefined;
    const shouldResume =
      looksLikeContinuation(message) ||
      !intent ||
      intent === 'read' ||
      matchedNew?.id === active.workflowId;

    if (shouldResume) {
      console.log(
        `[WorkflowRouter] Resuming active instance ${active.instanceId} (${active.workflowId})`,
      );
      return await engine.resume(active.instanceId, {
        type: 'USER_MESSAGE',
        content: message,
      });
    } else {
      console.log(
        `[WorkflowRouter] Intent shift detected (${intent}). Clearing active instance.`,
      );
      await engine.clearActiveInstance(userId);
    }
  }

  // 2. Exhaustive Intent Switch (The "Intent Router")
  if (!intent || !classification) return opts.agentFallback();

  console.log(
    `[WorkflowRouter] Routing intent: "${intent}" (length: ${intent?.length}, type: ${typeof intent})`,
  );

  switch (intent) {
    case 'maintenance_request':
    case 'report_maintenance':
      routerLogger.log(`[RouterMatch] maintenance_resolution`);
      return handleWorkflowRouting('maintenance_resolution', engine, opts);

    case 'rent_extension_request':
      routerLogger.log(`[RouterMatch] rent_extension_request`);
      return handleWorkflowRouting('rent_extension_request', engine, opts);

    case 'tenant_import':
      return handleWorkflowRouting('tenant_import', engine, opts);

    case 'tenant_complaint':
    case 'general_complaint':
    case 'collection_status': // Handle payment struggles naturally
      return {
        status: 'DIRECT_RESPONSE',
        prompt: `The user has a concern or question: "${message}". 
                 If it's a complaint, respond with empathy. 
                 If they're struggling to pay (collection_status), acknowledge the difficulty, express empathy as a property manager, and ask if they have a specific date in mind to pay (rent_extension_request). 
                 DO NOT start a workflow yet.`,
        context: { ...context, intent },
      };

    case 'lease_question':
    case 'check_rent_status':
    case 'portfolio_performance':
    case 'record_payment':
      // These intents are best handled by the agent tool loop (DIRECT_LOOKUP/INTELLIGENCE)
      return opts.agentFallback();

    case 'security_violation':
      routerLogger.log(`[RouterMatch] DIRECT_RESPONSE (security_violation)`);
      return {
        status: 'DIRECT_RESPONSE',
        prompt: `The user made an unauthorized or suspicious request: "${message}". Politely but firmly refuse based on security policies and data privacy.`,
        context: { ...context, intent },
      };

    default:
      if (opts.role === 'COMPANY_STAFF' || opts.role === 'SUPER_ADMIN') {
        routerLogger.log(
          `[RouterRoleMatch] STAFF/ADMIN best-effort passage for intent="${intent}"`,
        );
        return opts.agentFallback(
          `[HINT: Perform a broad search for requested entities using any available identifiers before asking for clarification. Summarize results naturally in Nairobi style.]`,
        );
      }
      return opts.agentFallback();
  }
};

/**
 * Information Gate Logic
 */
async function handleWorkflowRouting(
  workflowId: string,
  engine: WorkflowEngine,
  opts: RouteRequestOptions,
): Promise<RouteResult | any> {
  const { userId, classification, context = {} } = opts;

  // 1. Run the Guard (The Information Gate)
  const guard = checkWorkflowGuard(workflowId, classification);
  if (!guard.allowed) {
    console.log(
      `[WorkflowRouter] Information Gate: ${workflowId} needs info. Missing: ${guard.missingFields?.join(', ')}`,
    );
    return {
      status: 'NEEDS_INFO',
      missingFields: guard.missingFields || [],
      pendingIntent: workflowId,
      collectedEntities: classification!.entities || {},
      prompt: `Regarding your request for ${workflowId.replace(/_/g, ' ')}, I noticed I'm missing some details: ${guard.missingFields?.join(', ')}. Please ask the user for these details naturally and empathetic.`,
    };
  }

  // 2. Start Workflow (Execute immediately since information gate has passed)
  console.log(`[WorkflowRouter] Starting ${workflowId} for user ${userId}`);
  return engine.create(workflowId, userId, context, { deferExecution: false });
}
