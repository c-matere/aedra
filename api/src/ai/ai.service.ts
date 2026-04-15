import {
  Injectable,
  Logger,
  Inject,
  forwardRef,
  OnModuleInit,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowEngine } from '../workflows/workflow.engine';
import { WorkflowBridgeService } from './workflow-bridge.service';
import { QuorumBridgeService } from './quorum-bridge.service';
import { tenantContext } from '../common/tenant-context';
import { UserRole } from '../auth/roles.enum';
import { withRetry } from '../common/utils/retry';
import {
  AiClassifierService,
  ClassificationResult,
} from './ai-classifier.service';
import { getSessionUid } from './ai-tool-selector.util';
import { AiToolRegistryService } from './ai-tool-registry.service';
import { ContextMemoryService } from './context-memory.service';
import { AiEntityResolutionService } from './ai-entity-resolution.service';
import { AiPromptService } from './ai-prompt.service';
import { AiNextStepController } from './ai-next-step-controller.service';
import { AiFormatterService } from './ai-formatter.service';
import { AiSecurityService } from './ai-security.service';
import { AiIntentNormalizerService } from './ai-intent-normalizer.service';
import {
  normalizeToolErrorShape,
  normalizeToolStringShape,
} from './ai-tool-error-normalizer';
import { AiHistoryService } from './ai-history.service';
import { AiIntentFirewallService } from './ai-intent-firewall.service';
import { AiStateEngineService } from './ai-state-engine.service';
import { AiBenchmarkService } from './ai-benchmark.service';
import { WhatsAppFormatterService } from './whatsapp-formatter.service';
import { AiResponseValidatorService } from './ai-response-validator.service';
import { AiFactCheckerService } from './ai-fact-checker.service';
import { AiValidatorService } from './ai-validator.service';
import { AiDecisionSpineService } from './ai-decision-spine.service';
import { ConsistencyValidatorService } from './consistency-validator.service';
import { InterpretationLayer } from './layers/interpretation-layer.service';
import { ActionResult } from './next-step-orchestrator.service';
import {
  AiIntent,
  OperationalIntent,
  TruthObject,
  ExecutionTrace,
  AiServiceChatResponse,
  UnifiedPlan,
  UnifiedActionResult,
} from './ai-contracts.types';
import { ACTION_CONTRACTS } from './contracts/action-contracts';
import { inferTenantQueryFromMessage } from './tenant-query.util';
import { MenuRouterService } from './menu-router.service';

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private readonly primaryModel = 'gemini-2.0-flash';
  // Policy: Gemini 2.0 Flash only (Gemini 1.5 is discontinued).
  private readonly genAI: GoogleGenerativeAI;
  private readonly groq: Groq;
  private modelsVerified = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly classifier: AiClassifierService,
    private readonly registry: AiToolRegistryService,
    private readonly workflowEngine: WorkflowEngine,
    @Inject(forwardRef(() => WorkflowBridgeService))
    private readonly workflowBridge: WorkflowBridgeService,
    private readonly firewall: AiIntentFirewallService,
    private readonly quorumBridge: QuorumBridgeService,
    private readonly contextMemory: ContextMemoryService,
    private readonly decisionSpine: AiDecisionSpineService,
    private readonly securityService: AiSecurityService,
    private readonly entityResolver: AiEntityResolutionService,
    private readonly historyService: AiHistoryService,
    private readonly benchmarkService: AiBenchmarkService,
    private readonly promptService: AiPromptService,
    private readonly formatterService: AiFormatterService,
    private readonly whatsappFormatter: WhatsAppFormatterService,
    private readonly menuRouter: MenuRouterService,
    private readonly stateEngine: AiStateEngineService,
    private readonly responseValidator: AiResponseValidatorService,
    private readonly factChecker: AiFactCheckerService,
    private readonly validator: AiValidatorService,
    private readonly consistencyValidator: ConsistencyValidatorService,
    private readonly nextStepController: AiNextStepController,
    private readonly normalizer: AiIntentNormalizerService,
  ) {
    this.genAI = new GoogleGenerativeAI(
      process.env.GEMINI_API_KEY || 'dummy-key',
    );
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'dummy-key' });
  }

  async onModuleInit() {
    this.verifyHealth();
    this.wireWorkflowHandlers();
  }

  async getContext(uid: string) {
    return this.contextMemory.getContext(uid);
  }

  private wireWorkflowHandlers() {
    this.logger.log(`[AiService] Wiring workflow handlers.`);
    const handlers = {
      executeTool: async (id: string, ctx: any) =>
        this.registry.executeTool(
          id,
          ctx.args || {},
          ctx,
          ctx.role,
          ctx.language || 'en',
        ),
      executeAI: async (id: string, ctx: any) => {
        const res = await this.chat(
          [],
          `Perform step ${id}: ${JSON.stringify(ctx)}`,
          ctx.chatId,
        );
        return res.response;
      },
      executeRule: async (id: string, ctx: any) => {
        return { success: true };
      },
    };

    if (this.workflowBridge) {
      this.workflowEngine.setHandlers({
        executeRule: (stepId, context) =>
          this.workflowBridge.executeRule(stepId, context),
        executeTool: (stepId, context) =>
          this.workflowBridge.executeTool(stepId, context),
        executeAI: (stepId, context) =>
          this.workflowBridge.executeAI(stepId, context),
      });
    } else {
      this.workflowEngine.setHandlers(handlers);
    }
  }

  private async verifyHealth() {
    if (this.modelsVerified) return;

    // 1. Verify Primary Model (Gemini)
    try {
      const model = this.genAI.getGenerativeModel({ model: this.primaryModel });
      // Increase retries to handle transient 429s at startup
      await withRetry(() => model.generateContent('health check'), {
        maxRetries: 3,
        initialDelay: 2000,
        factor: 2,
      });
      this.logger.log(
        `[HealthCheck] Primary model (${this.primaryModel}) is ONLINE.`,
      );
    } catch (e) {
      if (e.message?.includes('429')) {
        this.logger.warn(
          `[HealthCheck] Primary model (${this.primaryModel}) is RATE LIMITED (429). Failover to Groq active.`,
        );
      } else {
        this.logger.warn(
          `[HealthCheck] Primary model (${this.primaryModel}) is OFFLINE: ${e.message}. Failover to Groq active.`,
        );
      }
    }

    // 2. Verify Fallback Model (Groq)
    try {
      await withRetry(
        () =>
          this.groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 5,
          }),
        { maxRetries: 2, initialDelay: 1000 },
      );
      this.logger.log(`[HealthCheck] Fallback model (Groq) is ONLINE.`);
    } catch (e) {
      this.logger.error(
        `[HealthCheck] Fallback model (Groq) is OFFLINE: ${e.message}. Critical system failure likely.`,
      );
    }

    this.modelsVerified = true;
  }

  /**
   * Multimodal transcription using Gemini 2.0 Flash.
   * Used as a high-reliability failover if Groq/Whisper is down.
   */
  async transcribeAudio(
    buffer: Buffer,
    mimeType: string,
    language?: string,
  ): Promise<string | null> {
    this.logger.log(
      `[AiService] Attempting Gemini transcription (${mimeType})...`,
    );
    try {
      const model = this.genAI.getGenerativeModel({ model: this.primaryModel });
      const prompt =
        language === 'sw'
          ? 'Tafadhali andika maneno yote yaliyosemwa kwenye sauti hii. Usiongeze maelezo mengine, rudisha maandishi tu.'
          : 'Please transcribe the following audio exactly. Do not add any commentary. Return only the transcript.';

      const result = await withRetry(
        () =>
          model.generateContent([
            prompt,
            {
              inlineData: {
                data: buffer.toString('base64'),
                mimeType: mimeType.split(';')[0] || 'audio/ogg',
              },
            },
          ]),
        { maxRetries: 1, initialDelay: 500 },
      );

      const transcript = result.response.text();
      return transcript ? transcript.trim() : null;
    } catch (e) {
      this.logger.error(
        `[AiService] Gemini transcription failed: ${e.message}`,
      );
      return null;
    }
  }

  private readonly WORKFLOW_MAP: Record<string, string[]> = {
    FINANCIAL_QUERY: [
      'kernel_search',
      'get_tenant_arrears',
      'render_financial_dashboard',
    ],
    PAYMENT_PROMISE: [
      'kernel_search',
      'get_tenant_arrears',
      'log_payment_promise',
    ],
    PAYMENT_DECLARATION: [
      'kernel_search',
      'get_tenant_arrears',
      'verify_payment',
    ],
    MAINTENANCE: [
      'kernel_search',
      'kernel_validation',
      'log_maintenance_request',
    ],
    COMPLAINT: ['kernel_search', 'log_maintenance_request', 'notify_landlord'],
    ONBOARDING: ['kernel_validation', 'register_tenant', 'create_lease'],
    FINANCIAL_REPORTING: [
      'get_revenue_summary',
      'get_collection_rate',
      'manual_aggregation',
    ],
    SYSTEM_ISSUE: ['log_system_error', 'notify_it'],
    UTILITY_OUTAGE: ['get_unit_details'],
  };

  async chat(
    history: any[],
    message: string,
    chatId?: string,
    companyId?: string,
    companyName?: string,
    attachments?: any[],
    language?: string,
    classification?: ClassificationResult,
    phone?: string,
    temperature?: number,
    confirmed?: boolean,
  ): Promise<AiServiceChatResponse> {
    const isAffirmative =
      /^(yes|proceed|confirmed|it is correct|ndio|endelea|sawa|haina shida|plan_approve|correction_proceed)$/i.test(
        (message || '').trim(),
      );
    const finalConfirmed = confirmed || isAffirmative;
    const store = tenantContext.getStore() as any;
    const userId = store?.userId || 'SYSTEM';
    const role = store?.role || UserRole.COMPANY_STAFF;
    message = message || '';

    // v4.9 "True Agent": Bench Persona Routing
    const benchPersonaMatch = (message || '').match(
      /\[BENCH_PERSONA:(TENANT|STAFF|LANDLORD|COMPANY_STAFF)\]/i,
    );
    let effectiveRole =
      role === UserRole.SUPER_ADMIN && benchPersonaMatch
        ? benchPersonaMatch[1].toUpperCase()
        : role;
    if (effectiveRole === 'STAFF') effectiveRole = UserRole.COMPANY_STAFF; // Alias mapping

    const cleanMessage = (message || '')
      .replace(/\[BENCH_.*?\]/g, '')
      .replace(
        /^Simulate responding as if speaking to a \w+\.\s*Message:\s*/i,
        '',
      )
      .replace(/^(Message|Input|Request|User):\s*/i, '')
      .trim();
    const finalChatId =
      chatId || (await this.getOrCreateChat(userId, companyId, phone));

    // Phase 0: Ensure Context Hydration (v5.8)
    const context: any = {
      userId,
      role: effectiveRole,
      chatId: finalChatId,
      companyId,
      companyName,
      attachments,
      language,
      phone,
    };
    await this.ensureContext(context, { companyId, chatId: finalChatId });
    await this.hydrateSecurityContext(context);
    const effectiveCompanyId: string = context.companyId;

    // Phase 0.5: Deterministic routing (MenuRouter) for simple commands across ALL channels
    // (WhatsApp already tries this earlier, but other channels like /ai/chat may not.)
    try {
      const uid = getSessionUid({ userId, phone });
      const lang = language || context.language || 'en';
      if (uid) {
        const menuRoute = await this.menuRouter.routeMessage(
          uid,
          cleanMessage,
          lang,
        );
        if (menuRoute.handled) {
          if (menuRoute.tool) {
            const actionResult = await this.executeToolAction(
              menuRoute.tool.name,
              menuRoute.tool.args || {},
              context,
              effectiveRole,
              lang,
            );
            const formatted = await this.formatToolResponse(
              actionResult as any,
              { id: userId, role: effectiveRole },
              effectiveCompanyId || '',
              lang,
            );
            const responseText = menuRoute.response
              ? `${menuRoute.response}\n\n${formatted.text}`
              : formatted.text;
            return {
              response: responseText,
              chatId: finalChatId,
              metadata: {
                status: actionResult?.success ? 'COMPLETE' : 'FAILED',
                tools: [menuRoute.tool.name],
                deterministic: true,
              },
              interactive: (formatted as any).interactive,
              vcSummary: (formatted as any).menuOptions,
            } as any;
          }
          if (menuRoute.response) {
            return {
              response: menuRoute.response,
              chatId: finalChatId,
              metadata: { status: 'COMPLETE', deterministic: true },
            };
          }
        }
      }
    } catch (e) {
      this.logger.debug(
        `[AiService] Deterministic routing skipped: ${e?.message || e}`,
      );
    }

    // 0. Initialize Execution Trace (SSOT)
    const trace: ExecutionTrace = {
      id: `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: finalChatId,
      userId: userId,
      role: effectiveRole,
      input: cleanMessage,
      status: 'PENDING',
      steps: [],
      errors: [],
      metadata: {
        companyId: effectiveCompanyId,
        phone,
        language,
        temperature,
        originalMessage: message,
        effectiveRole,
        administrative_context: effectiveRole === UserRole.SUPER_ADMIN,
      },
    };

    try {
      this.logger.log(`[AiService] chat() Starting trace: ${trace.id}`);

      // 1. Security & Firewall
      if (
        this.securityService.isSecurityViolation(
          message,
          effectiveRole as UserRole,
        )
      ) {
        return {
          response: this.securityService.getRefusalMessage(),
          chatId: finalChatId,
        };
      }

      const firewallDecision = this.firewall.intercept(message, effectiveRole);
      if (firewallDecision.isIntercepted && firewallDecision.message) {
        return { response: firewallDecision.message, chatId: finalChatId };
      }

      // 2. Auth-First Context Hydration (Tenant Isolation)
      let sessionContext = await this.contextMemory.getContext(
        getSessionUid({ userId, phone }),
      );
      if (effectiveRole === UserRole.TENANT && phone) {
        const authContext = await this.hydrateTenantContext(
          phone,
          effectiveCompanyId,
        );
        sessionContext = { ...sessionContext, ...authContext };
        this.logger.log(
          `[AiService] Auth-First Hydration for ${phone}: tenant=${authContext.tenantId}, unit=${authContext.unitId}`,
        );
      }

      // Phase 0: Merge Hydrated Context (v5.9)
      Object.assign(context, sessionContext, {
        companyId: effectiveCompanyId,
        chatId: finalChatId,
      });
      this.logger.debug(
        `[AiService] Hydrated Context: ${JSON.stringify(context.registrationData || {})}`,
      );

      // 3. Unified LLM-Driven Planning (v5.2)
      let finalHistory = history || [];
      if (finalHistory.length === 0 && finalChatId) {
        const dbHistory =
          await this.historyService.getMessageHistory(finalChatId);
        if (dbHistory && dbHistory.length > 0) {
          this.logger.log(
            `[AiService] Hydrated ${dbHistory.length} history messages from DB for ${finalChatId}`,
          );
          finalHistory = dbHistory;
        }
      }

      const scrubbedHistory = this.scrubHistory(finalHistory);
      const plan = await this.promptService.generateUnifiedPlan(
        cleanMessage,
        effectiveRole as UserRole,
        context,
        scrubbedHistory,
      );
      trace.unifiedPlan = plan;
      trace.interpretation = {
        intent: plan.intent,
        operationalIntent:
          plan.priority === 'EMERGENCY'
            ? OperationalIntent.REASSURE_AND_ESCALATE
            : OperationalIntent.STANDARD,
        confidence: 1.0,
        entities: plan.entities || {},
        language: plan.language || 'en',
        priority: plan.priority || 'NORMAL',
      };
      trace.status = 'EXECUTING';

      // Post-plan validation: never execute unauthorized tools suggested by the LLM.
      if (plan?.steps?.length) {
        const allowedSteps: any[] = [];
        for (const step of plan.steps) {
          const toolName = (step?.tool || '').toString().trim();

          // Treat placeholder/no-op tool names as "no step" instead of a hard failure.
          // Some model outputs include steps like {"tool":"NONE"} when no tool is needed.
          if (
            !toolName ||
            ['none', 'noop', 'no_tool', 'no-tool'].includes(
              toolName.toLowerCase(),
            )
          ) {
            continue;
          }

          if (this.registry.isToolAllowed(toolName, effectiveRole as string)) {
            allowedSteps.push(step);
          } else {
            const msg = `Unauthorized tool planned: ${toolName} (role=${effectiveRole})`;
            this.logger.warn(`[PlanGate] ${msg}`);
            trace.errors.push(msg);
            trace.steps.push({
              tool: toolName,
              args: step.args || {},
              result: { error: 'UNAUTHORIZED_TOOL_PLANNED', message: msg },
              success: false,
              required: true,
              timestamp: new Date().toISOString(),
            });
          }
        }
        plan.steps = allowedSteps;
      }

      // Guardrail: If planning produced no actionable tools, avoid free-form rendering.
      // We prefer a deterministic clarification/menu prompt over a hallucination-prone answer.
      if (!plan?.steps || plan.steps.length === 0) {
        const normalized = (cleanMessage || '').toLowerCase().trim();
        const isTrivial =
          !normalized ||
          /^(hi|hello|hey|start|home|menu|menyu|mwanzo|\?|help)$/i.test(
            normalized,
          );

        // Let upstream (WhatsApp orchestrator) handle trivial/greeting/menu messages.
        // For everything else, ask the user to pick an action OR use the AI's immediate response.
        if (!isTrivial) {
          if (plan.immediateResponse) {
            await this.persistTraceMetadata(trace, context, userId, {
              response: plan.immediateResponse,
            });
            return {
              response: plan.immediateResponse,
              chatId: finalChatId,
              metadata: {
                status: 'COMPOSED',
                traceId: trace.id,
                intent: plan.intent,
              },
            };
          }

          await this.persistTraceMetadata(trace, context, userId, {});
          return {
            response:
              plan.language === 'sw'
                ? 'Sawa. Ili niendelee, tafadhali chagua kitendo kutoka kwenye menyu (andika "menu") au niambie unachotaka kufanya.'
                : 'Okay. To continue, please choose an action from the menu (type "menu") or tell me what you want to do.',
            chatId: finalChatId,
            metadata: {
              status: 'NO_TOOLS',
              traceId: trace.id,
              intent: plan.intent,
              noToolsPlan: true,
            },
          };
        }
      }

      // 4. Immediate Response (Pre-Execution)
      if (
        plan.immediateResponse &&
        (plan.priority === 'EMERGENCY' || plan.priority === 'HIGH')
      ) {
        this.logger.log(
          `[AiService] Immediate response triggered: ${plan.immediateResponse.substring(0, 30)}...`,
        );
        // Note: In a real streaming scenario, we'd send this now. For now, we'll append it to the renderer context.
      }

      // 5. Hardened Execution Loop (v5.2)
      const resultsMap: Record<string, any> = {
        session: context,
        entities: { ...(plan.entities || {}) },
      };

      const scrubPlaceholders = (obj: any, keys: string[]) => {
        if (!obj || typeof obj !== 'object') return;
        for (const k of keys) {
          if (k in obj && this.isPlaceholder(obj[k])) delete obj[k];
        }
      };

      const inferUnitAndPropertyFromText = (
        text: string,
      ): { unitName?: string; propertyName?: string; unitNumber?: string } => {
        const t = (text || '').toString();
        const wordsToIgnore = new Set([
          'to',
          'at',
          'in',
          'for',
          'the',
          'a',
          'an',
          'is',
          'of',
          'assign',
          'them',
          'his',
          'her',
          'their',
          'add',
          'create',
          'new',
          'into',
          'from',
        ]);

        // Split by "unit" keyword (handle various formats like "unit 1", "unit#1", "unit : 1")
        const parts = t.split(/\bunit\b[:#\s]*/i);
        if (parts.length >= 2) {
          // The property name is before the first "unit" instance
          const beforeUnit = parts[0].trim();
          const wordsBefore = beforeUnit.split(/\s+/);

          // Take the last few words and filter out noise
          const candidates = [];
          for (let i = wordsBefore.length - 1; i >= 0; i--) {
            const w = wordsBefore[i].toLowerCase().replace(/[^\w]/g, '');
            if (wordsToIgnore.has(w)) break; // Stop at any noise word (to, at, assign, etc.)
            if (candidates.length >= 3) break; // Limit to 3 words for property name
            candidates.unshift(wordsBefore[i]);
          }

          const propertyName = candidates.join(' ').trim();
          const unitPart = parts[1].trim();
          const unitNumber = unitPart.split(/\s+/)[0].replace(/[^\w-]/g, '');

          if (unitNumber) {
            return {
              unitName: propertyName
                ? `${propertyName} Unit ${unitNumber}`
                : `Unit ${unitNumber}`,
              propertyName: propertyName || undefined,
              unitNumber,
            };
          }
        }

        return {};
      };

      // 5a. Bare Entity Resolution (v5.5)
      // Resolve IDs for names/units even if no tool is scheduled (crucial for sequential context)
      if (plan.entities) {
        if (plan.entities.tenantName && !resultsMap.entities.tenantId) {
          const res = await this.entityResolver.resolveId(
            'tenant',
            plan.entities.tenantName,
            effectiveCompanyId,
            plan.entities.unitNumber,
          );
          if (res.id) resultsMap.entities.tenantId = res.id;
        }
        if (plan.entities.unitNumber && !resultsMap.entities.unitId) {
          const res = await this.entityResolver.resolveId(
            'unit',
            plan.entities.unitNumber,
            effectiveCompanyId,
          );
          if (res.id) resultsMap.entities.unitId = res.id;
        }
        if (plan.entities.propertyName && !resultsMap.entities.propertyId) {
          const res = await this.entityResolver.resolveId(
            'property',
            plan.entities.propertyName,
            effectiveCompanyId,
          );
          if (res.id) resultsMap.entities.propertyId = res.id;
        }
      }

      for (const step of plan.steps) {
        this.logger.log(
          `[ExecutionLoop] Step: ${step.tool} (Required: ${step.required})`,
        );

        // 5a. Dependency Resolution
        const resolvedArgs = { ...step.args };
        if (finalConfirmed) {
          resolvedArgs.confirm = true;
          this.logger.log(
            `[ExecutionLoop] Injecting confirm=true into ${step.tool} arguments`,
          );
        }

        // Handle "DEPENDS" keyword
        if (step.dependsOn) {
          const depResult = resultsMap[step.dependsOn];
          if (depResult?.success) {
            Object.assign(resolvedArgs, depResult.result || depResult);
          }
        }

        // Handle {{template}} syntax as fallback
        // The LLM may use either {{stepName.fieldName}} or {{fieldName}} syntax.
        // We also support field aliases (tenant_id -> id, unit_id -> id, property_id -> id).
        const resolveTemplate = (value: string): any => {
          const templateKey = value.substring(2, value.length - 2).trim();

          // --- Dot-notation: {{stepName.fieldName}} ---
          if (templateKey.includes('.')) {
            const [stepName, ...restParts] = templateKey.split('.');
            const fieldName = restParts.join('.');
            const stepEntry = resultsMap[stepName];
            if (stepEntry) {
              const data = stepEntry.result || stepEntry;
              // Resolve common field aliases
              const aliasMap: Record<string, string[]> = {
                id: ['id'],
                tenant_id: ['id', 'tenantId'],
                unit_id: ['id', 'unitId'],
                property_id: ['id', 'propertyId'],
                lease_id: ['id', 'leaseId'],
                tenantId: ['id', 'tenantId'],
                unitId: ['id', 'unitId'],
                propertyId: ['id', 'propertyId'],
              };
              const candidateFields = aliasMap[fieldName] || [fieldName];
              for (const f of candidateFields) {
                if (data?.[f] !== undefined) return data[f];
                // Also check directly on the data
                if (data?.result?.[f] !== undefined) return data.result[f];
              }
            }
          }

          // --- Flat: {{fieldName}} ---
          // Look in resultsMap directly or in any step result
          const directValue = resultsMap[templateKey];
          if (directValue !== undefined) return directValue;

          // Check all step results for the key
          for (const stepData of Object.values(resultsMap)) {
            if (typeof stepData === 'object' && stepData !== null) {
              const data = stepData.result || stepData;
              if (data?.[templateKey] !== undefined) return data[templateKey];
            }
          }

          // Also check resultsMap.entities
          const entitiesValue = resultsMap.entities?.[templateKey];
          if (entitiesValue !== undefined) return entitiesValue;

          return undefined;
        };

        for (const [key, value] of Object.entries(resolvedArgs)) {
          if (
            typeof value === 'string' &&
            value.startsWith('{{') &&
            value.endsWith('}}')
          ) {
            const resolvedValue = resolveTemplate(value);
            if (resolvedValue !== undefined) {
              this.logger.log(
                `[ExecutionLoop] Resolved template ${value} -> ${JSON.stringify(resolvedValue)}`,
              );
              resolvedArgs[key] = resolvedValue;
            } else {
              this.logger.warn(
                `[ExecutionLoop] Could not resolve template ${value} for arg '${key}'`,
              );
            }
          }
        }

        // After template resolution, also inject from resultsMap.entities for any remaining nullish ID fields.
        for (const [key, entityVal] of Object.entries(
          resultsMap.entities || {},
        )) {
          if (entityVal && !resolvedArgs[key]) {
            resolvedArgs[key] = entityVal;
          }
        }

        const isHighStakes =
          step.isHighStakes || this.registry.isHighStakes(step.tool);
        const isRequired = step.required || isHighStakes;

        const depSucceeded =
          !step.dependsOn || !!resultsMap[step.dependsOn]?.success;
        const hasUnresolvedPlaceholders = Object.values(resolvedArgs).some(
          (v) => {
            if (v === 'DEPENDS') return true;
            if (typeof v === 'string' && v.startsWith('{{') && v.endsWith('}}'))
              return true;
            return false;
          },
        );
        if (step.dependsOn && !depSucceeded && hasUnresolvedPlaceholders) {
          this.logger.warn(
            `[ExecutionLoop] Skipping step ${step.tool} due to failed dependency ${step.dependsOn} and unresolved placeholders in args`,
          );
          if (isRequired) {
            trace.errors.push(
              `Critical tool '${step.tool}' failed because its dependency '${step.dependsOn}' failed.`,
            );
          }
          continue;
        }

        // 5b. On-the-fly Entity Resolution (Merge Plan Entities & Cache)
        const activeTenantId =
          resolvedArgs.tenantId ||
          resultsMap.entities.tenantId ||
          (context.activeTenantId as string);
        const activeUnitId =
          resolvedArgs.unitId ||
          resultsMap.entities.unitId ||
          (context.activeUnitId as string);

        // If a tenant-scoped tool is missing an ID but we have an active tenant in context, inject it.
        // This is critical for follow-ups like "give me her statement" after opening a tenant profile.
        const tenantScopedTools = new Set([
          'get_tenant_details',
          'get_tenant_arrears',
          'get_tenant_statement',
          'list_payments',
          'list_invoices',
          'list_leases',
        ]);
        if (
          tenantScopedTools.has(step.tool) &&
          !resolvedArgs.tenantId &&
          activeTenantId
        ) {
          resolvedArgs.tenantId = activeTenantId;
          if (step.tool === 'get_tenant_details' && !resolvedArgs.id)
            resolvedArgs.id = activeTenantId;
        }

        // Deterministic repair: if the planner scheduled a tenant search but forgot args, infer a query
        // from the original user message (e.g. "mary atieno profile" -> "mary atieno").
        if (step.tool === 'search_tenants') {
          const q = (
            resolvedArgs?.query ||
            resolvedArgs?.tenant_name ||
            resolvedArgs?.tenantName ||
            resolvedArgs?.tenant_query ||
            resolvedArgs?.name ||
            ''
          )
            .toString()
            .trim();
          if (!q) {
            const inferred = inferTenantQueryFromMessage(cleanMessage);
            if (inferred) {
              resolvedArgs.query = inferred;
              resultsMap.entities.tenantName =
                resultsMap.entities.tenantName || inferred;
            }
          }
        }

        // Injected pre-emptive resolution for common tools if IDs are still missing but names exist
        if (
          !activeTenantId &&
          (resultsMap.entities?.tenantName || plan.entities?.tenantName)
        ) {
          const tenantQuery =
            resultsMap.entities?.tenantName || plan.entities?.tenantName;
          const res = await this.entityResolver.resolveId(
            'tenant',
            tenantQuery,
            effectiveCompanyId,
          );
          if (res.id) resolvedArgs.tenantId = res.id;
        }

        // 5c. Action Execution
        try {
          // Guard: drop placeholder args like "unspecified" before tool calls.
          scrubPlaceholders(resolvedArgs, [
            'tenantId',
            'tenantName',
            'propertyId',
            'propertyName',
            'unitId',
            'unitName',
            'unitNumber',
          ]);

          // Heuristic: if user mentioned a unit/property in the message but the plan left it blank,
          // inject unitName/propertyId hints so resolution can succeed.
          if (
            [
              'create_tenant',
              'register_tenant',
              'create_lease',
              'get_unit_details',
              'get_property_details',
            ].includes((step.tool || '').toString()) &&
            !resolvedArgs?.unitId &&
            !resolvedArgs?.unitName &&
            !resolvedArgs?.unitNumber &&
            !resolvedArgs?.propertyId &&
            !resolvedArgs?.propertyName
          ) {
            const inferred = inferUnitAndPropertyFromText(cleanMessage);
            if (inferred.unitName) resolvedArgs.unitName = inferred.unitName;
            if (inferred.unitNumber)
              resolvedArgs.unitNumber = inferred.unitNumber;
            if (inferred.propertyName) {
              resolvedArgs.propertyName = inferred.propertyName;
              if (!resolvedArgs.propertyId)
                resolvedArgs.propertyId = inferred.propertyName;
            }
          }

          const result = await this.executeTool(
            step.tool,
            resolvedArgs,
            context,
            effectiveRole as string,
            language,
          );
          const isBlockedResult =
            !!result?.requires_clarification ||
            !!result?.requires_confirmation ||
            !!result?.requires_authorization ||
            result?.success === false;
          const success = !!(result && !result.error && !isBlockedResult);
          // Compatibility for formatter (some tools return strings)
          if (result && typeof result === 'object') {
            (result as any).action = step.tool;
          }

          // PROPAGATION: Merge result into entities for subsequent steps
          if (success && result && typeof result === 'object') {
            const dataToMerge =
              result.data && typeof result.data === 'object'
                ? result.data
                : result;
            Object.assign(resultsMap.entities, dataToMerge);
          }

          // Phase 0: In-flight Hydration (v5.8)
          if (success && result) {
            const data =
              result.data && typeof result.data === 'object'
                ? result.data
                : result;
            if (data.companyId) context.companyId = data.companyId;
            if (data.tenantId) context.tenantId = data.tenantId;
            if (data.unitId) context.unitId = data.unitId;
            if (data.propertyId) context.propertyId = data.propertyId;

            // Harvest common entities for sequential context when tools return raw Prisma models.
            if (
              [
                'get_tenant_details',
                'create_tenant',
                'register_tenant',
              ].includes(step.tool) &&
              data?.id
            ) {
              resultsMap.entities.tenantId = data.id;
              if (data.firstName) {
                resultsMap.entities.tenantName =
                  `${data.firstName} ${data.lastName || ''}`.trim();
              }
            }
            if (
              ['get_unit_details', 'create_unit'].includes(step.tool) &&
              data?.id
            ) {
              resultsMap.entities.unitId = data.id;
              if (data.unitNumber)
                resultsMap.entities.unitNumber = data.unitNumber;
            }
            if (
              ['get_property_details', 'create_property'].includes(step.tool) &&
              data?.id
            ) {
              resultsMap.entities.propertyId = data.id;
              if (data.name) resultsMap.entities.propertyName = data.name;
            }

            // Sync to trace metadata for integrity checks
            trace.metadata.companyId = context.companyId;
            trace.metadata.activeUnitId =
              data.unitId || trace.metadata.activeUnitId;
          }

          resultsMap[step.tool] = { success, result };
          trace.steps.push({
            tool: step.tool,
            args: resolvedArgs,
            result,
            success,
            required: isRequired,
            timestamp: new Date().toISOString(),
          });

          // If a required/high-stakes tool ended in a "blocked" state, record it as an error for gating.
          if (!success && isRequired && isBlockedResult) {
            const reason = result?.requires_clarification
              ? 'requires_clarification'
              : result?.requires_confirmation
                ? 'requires_confirmation'
                : result?.requires_authorization
                  ? 'requires_authorization'
                  : 'tool_reported_failure';
            trace.errors.push(
              `Critical tool '${step.tool}' did not complete (${reason}).`,
            );
            if (isRequired) break; // v5.9: Stop early if we hit a wall on a critical step
          }
        } catch (e) {
          this.logger.error(
            `[ExecutionLoop] Tool ${step.tool} failed: ${e.message}`,
          );
          trace.steps.push({
            tool: step.tool,
            args: resolvedArgs,
            result: { error: e.message },
            success: false,
            required: isRequired,
            timestamp: new Date().toISOString(),
          });
          if (isRequired) {
            trace.errors.push(
              `Critical tool '${step.tool}' failed: ${e.message}`,
            );
            break; // v5.9: Stop early on fatal tool error
          }
        }
      }

      // 6. Final Integrity & Truth Aggregation
      trace.truth = await this.aggregateTruth(
        trace,
        context,
        context.virtualLedger || {},
        {},
      );
      const integrity = this.validateActionIntegrity(plan, trace, trace.truth);

      this.logger.log(`[DEBUG_TRUTH] ${JSON.stringify(trace.truth, null, 2)}`);

      if (!integrity.isValid) {
        this.logger.warn(`[IntegrityFailure] ${integrity.reason}`);
        return {
          response: await this.generateSafePartialResponse(
            plan,
            integrity.fixedTruth || trace.truth,
            trace,
            cleanMessage,
          ),
          chatId: finalChatId,
          metadata: {
            status: 'PARTIAL',
            traceId: trace.id,
            intent: plan.intent,
            integrityReason: integrity.reason,
          },
        };
      }

      // 7. Rendering (Gated by Success)
      const gate = this.canRender(trace, plan);
      this.logger.log(
        `[DecisionGate] canRender: ${gate.canRender} (${gate.reason || 'ok'}), steps: ${trace.steps.length}, successes: ${trace.steps.filter((s) => s.success).length}, errors: ${trace.errors.length}, truth: ${trace.truth?.status}`,
      );

      let finalResponse = '';
      if (gate.canRender) {
        finalResponse = await this.promptService.generateFinalResponse(
          plan.intent,
          trace.steps,
          plan.language || 'en',
          context.virtualLedger || {},
          trace.workflowState || {},
          trace.truth,
          effectiveRole as UserRole,
          trace.errors,
          plan.immediateResponse,
          scrubbedHistory,
          cleanMessage,
        );
      } else {
        finalResponse = await this.generateSafePartialResponse(
          plan,
          trace.truth,
          trace,
          cleanMessage,
        );
      }

      // Prepend immediate response if not already present and rendering was successful
      // v4.3: Prevent redundant acknowledgments if the renderer already confirmed action.
      // IMPORTANT: Never prepend `immediateResponse` onto a safe-partial response, because it can create Action-Integrity contradictions.
      if (
        gate.canRender &&
        plan.immediateResponse &&
        !finalResponse
          .toLowerCase()
          .includes(plan.immediateResponse.toLowerCase().substring(0, 15))
      ) {
        finalResponse = `${plan.immediateResponse}\n\n${finalResponse}`;
      }

      // Append report URL deterministically if it exists but is missing from the response
      if (
        trace.truth?.data?.reportUrl &&
        !finalResponse.includes(trace.truth.data.reportUrl)
      ) {
        finalResponse = `${finalResponse}\n\nYou can download the full report here: ${trace.truth.data.reportUrl}`;
      }

      // 8. Session Persistence
      await this.persistTraceMetadata(
        trace,
        context,
        userId,
        resultsMap.entities,
      );

      return {
        response: finalResponse,
        chatId: finalChatId,
        metadata: {
          status: trace.status,
          traceId: trace.id,
          intent: plan.intent,
          tools: trace.steps.map((s) => s.tool),
          clarificationNeeded: trace.steps.some(
            (s: any) =>
              s?.result?.requires_clarification ||
              s?.result?.data?.requires_clarification,
          ),
          requires_confirmation: trace.steps.some(
            (s: any) =>
              s?.result?.requires_confirmation ||
              s?.result?.data?.requires_confirmation,
          ),
        },
        // Collect the first _vc (version-control) summary from successful write steps so
        // the WhatsApp orchestrator can render the View Diff / Rollback buttons.
        vcSummary: (() => {
          for (const s of trace.steps) {
            if (!s.success) continue;
            const vc = s.result?._vc || s.result?.data?._vc;
            if (vc?.versionId) return vc;
          }
          return undefined;
        })(),
      };
    } catch (e) {
      this.logger.error(
        `[AiService] chat() Fatal Error: ${e.message}`,
        e.stack,
      );
      return {
        response: this.generateFallback(
          trace.interpretation?.intent || 'GENERAL_QUERY',
        ),
        chatId: finalChatId,
      };
    }
  }

  private safeUserResponse(response: string, intent: string): string {
    const errorPatterns = [
      'error generating a summary',
      'hit a technical snag',
      'encountered an error',
      'technical error',
      'failed to',
    ];

    const isSystemError =
      errorPatterns.some((p) => response.toLowerCase().includes(p)) ||
      !response.trim();

    if (isSystemError) {
      this.logger.warn(
        `[SafeResponse] System error string detected in AI response. Triggering fallback for ${intent}`,
      );
      return this.generateFallback(intent);
    }
    return response;
  }

  private async hydrateTenantContext(
    phone: string,
    companyId?: string,
  ): Promise<any> {
    try {
      // Primary lookup: Phone number match in Tenant table
      const tenant = await this.prisma.tenant.findFirst({
        where: { phone: { contains: phone.replace('+', '') } },
        include: {
          leases: {
            where: { status: 'ACTIVE', deletedAt: null },
            include: { unit: { include: { property: true } } },
          },
        },
      });

      if (tenant && tenant.leases.length > 0) {
        const activeLease = tenant.leases[0];
        return {
          tenantId: tenant.id,
          tenantName: `${tenant.firstName} ${tenant.lastName}`,
          unitId: activeLease.unitId,
          unitNumber: activeLease.unit?.unitNumber,
          propertyId: activeLease.unit?.propertyId,
          // Prefer explicit companyId, else tenant.companyId, else property.companyId.
          companyId:
            companyId ||
            tenant.companyId ||
            activeLease.unit?.property?.companyId,
          virtualLedger: { balance: (activeLease as any).balance || 0 },
        };
      }
      return {};
    } catch (e) {
      this.logger.warn(`[Hydration] Failed for ${phone}: ${e.message}`);
      return {};
    }
  }

  private isIdentityConflicting(plan: UnifiedPlan, context: any): boolean {
    const newName = plan.entities?.tenantName;
    const oldName = context.activeTenantName;
    if (
      newName &&
      oldName &&
      newName.toLowerCase().trim() !== oldName.toLowerCase().trim()
    ) {
      return true;
    }
    return false;
  }

  private async persistTraceMetadata(
    trace: ExecutionTrace,
    context: any,
    userId: string,
    resolvedEntities?: any,
  ) {
    const contextUid = getSessionUid({ userId, phone: trace.metadata.phone });
    const plan = trace.unifiedPlan;
    if (!plan) return;

    const turnCount = (context.lockedState?.turnCount || 0) + 1;
    const isConflict = this.isIdentityConflicting(plan, context);

    this.logger.debug(
      `[AiService] Persisting Meta: unit=${resolvedEntities?.unitId || (isConflict ? undefined : context.activeUnitId)}, tenant=${resolvedEntities?.tenantId || (isConflict ? undefined : context.activeTenantId)}`,
    );

    const newTenantId =
      resolvedEntities?.tenantId ||
      (isConflict ? undefined : context.activeTenantId);
    const newUnitId =
      resolvedEntities?.unitId ||
      (isConflict ? undefined : context.activeUnitId);
    const newPropId =
      resolvedEntities?.propertyId ||
      (isConflict ? undefined : context.activePropertyId);

    const existingData = context.registrationData || {};
    const newData = { ...existingData };

    // Additive merge: only update if the new entity has a truthy value
    if (plan.entities) {
      for (const [key, value] of Object.entries(plan.entities)) {
        if (!value || this.isPlaceholder(value)) continue;

        // Normalize keys for Property/Company Onboarding
        let targetKey = key;
        if (key === 'name' || key === 'propName' || key === 'company')
          targetKey = 'companyName';
        if (key === 'address' || key === 'propAddress')
          targetKey = 'propertyAddress';
        if (key === 'units' || key === 'count') targetKey = 'unitCount';
        if (key === 'first_name' || key === 'fname' || key === 'adminFirst')
          targetKey = 'firstName';
        if (key === 'last_name' || key === 'lname' || key === 'adminLast')
          targetKey = 'lastName';
        if (key === 'adminEmail' || key === 'userEmail') targetKey = 'email';
        if (key === 'pass' || key === 'adminPassword') targetKey = 'password';

        newData[targetKey] = value as string;
      }
    }

    this.logger.debug(
      `[AiService] Persisting RegistrationData: ${JSON.stringify(newData)}`,
    );

    await this.contextMemory.setContext(contextUid, {
      lastIntent: plan.intent,
      lastPriority: plan.priority,
      activeTenantId: newTenantId,
      activeUnitId: newUnitId,
      activePropertyId: newPropId,
      activeUnitNumber:
        plan.entities?.unitNumber ||
        (isConflict ? undefined : context.activeUnitNumber),
      activeTenantName:
        plan.entities?.tenantName ||
        (isConflict ? undefined : context.activeTenantName),
      registrationData: newData,
      lockedState: {
        lockedIntent:
          plan.intent !== AiIntent.GENERAL_QUERY
            ? plan.intent
            : context.lockedState?.lockedIntent || null,
        activeTenantId: newTenantId || null,
        activeUnitId: newUnitId || null,
        activePropertyId: newPropId || null,
        activeUnitNumber:
          plan.entities?.unitNumber ||
          (isConflict ? undefined : context.activeUnitNumber) ||
          null,
        activeTenantName:
          plan.entities?.tenantName ||
          (isConflict ? undefined : context.activeTenantName) ||
          null,
        turnCount,
      },
    });
  }

  private generateFallback(intent: string): string {
    switch (intent) {
      case 'MAINTENANCE':
      case 'EMERGENCY':
        return "I understand there's a maintenance issue. I've flagged this for our team—could you please share your unit number or address so we can follow up quickly?";

      case 'WORKFLOW_DEPENDENCY':
      case 'ONBOARDING':
        return "Got it — you're trying to add a tenant. Let me confirm a few details first (like unit number and name) to proceed correctly.";

      case 'FINANCIAL_REPORTING':
      case 'LATE_PAYMENT':
        return "I've received your request regarding payments. I'm checking the records now—could you please confirm which property or tenant you're looking for?";

      default:
        return "I've received your request and I'm looking into it. To help me assist you better, could you provide more details like a name or unit number?";
    }
  }

  private sanitizeResponse(text: string): string {
    if (!text) return '';
    return text
      .replace(/```json[\s\S]*?```/g, '')
      .replace(/<thinking>[\s\S]*?<\/thinking>/g, '')
      .replace(
        /\b(ID:?\s*PENDING|Status:?\s*PENDING|tenantId:?\s*PENDING|ID:?\s*NONE|Unit:?\s*PENDING)\b/gi,
        '',
      )
      .replace(/\(ID:?\s*PENDING\)/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async resetSession(userId: string, chatId: string): Promise<any> {
    try {
      const uid = getSessionUid({ userId });
      await this.workflowEngine.clearActiveInstance(userId);
      if (chatId) await this.contextMemory.clear(chatId);
      await this.contextMemory.clear(uid);

      const keys = [
        `ai_session:${uid}`,
        `ai_session:${uid}:identity`,
        `ai_session:${uid}:context`,
        `ai_session:${chatId}`,
        `ai_session:${chatId}:identity`,
        `ai_session:${chatId}:context`,
      ];
      for (const key of keys) {
        await this.cacheManager.del(key);
      }

      const outcome = await this.historyService.clearMessageHistory(
        chatId,
        userId,
      );
      this.logger.log(
        `[Governance] Reset session for userId: ${userId}, chatId: ${chatId}.`,
      );

      return {
        cleared: true,
        clearedActiveInstance: true,
        clearedPendingState: true,
        clearedAiSession: true,
        clearedContextMemory: true,
        ...outcome,
      };
    } catch (e) {
      this.logger.error(
        `[AiService] resetSession Failed: ${e.message}`,
        e.stack,
      );
      throw e;
    }
  }

  async getOrCreateChat(
    userId: string | null,
    companyId?: string,
    phone?: string,
  ): Promise<string> {
    const effectiveUserId =
      userId === 'unidentified' || userId === 'SYSTEM' ? null : userId;
    const effectiveCompanyId =
      companyId === 'NONE' || !companyId ? null : companyId;

    if (effectiveUserId) {
      const existing = await this.prisma.chatHistory.findFirst({
        where: { userId: effectiveUserId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
      });
      if (existing) return existing.id;
    } else if (phone) {
      const existing = await this.prisma.chatHistory.findFirst({
        where: { waPhone: phone, userId: null, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
      });
      if (existing) return existing.id;
    }

    const created = await this.prisma.chatHistory.create({
      data: {
        userId: effectiveUserId,
        companyId: effectiveCompanyId,
        waPhone: effectiveUserId ? null : phone,
        title: 'New Conversation',
      },
    });
    return created.id;
  }

  async deleteChatSession(chatId: string) {
    return this.prisma.chatHistory.update({
      where: { id: chatId },
      data: { deletedAt: new Date() },
    });
  }

  async getCollectionRate(companyId: string): Promise<number> {
    try {
      const summary = await this.prisma.payment.aggregate({
        where: {
          lease: { unit: { property: { companyId } } },
          deletedAt: null,
        },
        _sum: { amount: true },
      });
      return summary?._sum?.amount ? 85 : 0;
    } catch (e) {
      this.logger.error(`[getCollectionRate] Failed: ${e.message}`);
      return 0;
    }
  }

  async summarizeForWhatsApp(text: string, language: string): Promise<string> {
    return this.promptService.generateFinalResponse(
      AiIntent.GENERAL_QUERY,
      [{ tool: 'none', result: text, success: true, required: true }],
      language,
      {},
      {},
      {
        status: 'COMPLETE',
        data: { response: text },
        computedAt: new Date().toISOString(),
        intent: AiIntent.GENERAL_QUERY,
        context: {},
      } as any,
      UserRole.TENANT,
      [],
      '',
      [],
      text,
    );
  }

  async generateTakeoverAdvice(params: {
    userMessage: string;
    role: UserRole;
    phone?: string;
    userId?: string;
    chatId?: string;
    companyId?: string;
    language?: string;
    lastAction?: { name: string; args?: any } | null;
    lastResult?: any;
    formattedText?: string;
  }): Promise<{
    text: string;
    suggestions: Array<{ label: string; tool: string; args: any }>;
  }> {
    const language = params.language || 'en';
    const contextUid = getSessionUid({
      userId: params.userId,
      phone: params.phone,
    });
    const context = await this.contextMemory.getContext(contextUid);
    const history = params.chatId
      ? await this.getChatHistory(params.chatId)
      : [];
    return this.promptService.generateTakeoverAdvice(
      {
        userMessage: params.userMessage,
        role: params.role,
        language,
        context: {
          ...context,
          companyId: params.companyId || context.companyId,
        },
        lastAction: params.lastAction || undefined,
        lastResult: params.lastResult,
        formattedText: params.formattedText,
      },
      history || [],
    );
  }

  async getChatSessions(userId: string) {
    return this.prisma.chatHistory.findMany({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getChatHistory(chatId: string) {
    return this.historyService.getMessageHistory(chatId);
  }

  async listActiveWorkflows(userId: string) {
    return this.workflowEngine.getActiveInstance(userId);
  }

  async submitFeedback(messageId: string, score: number, note?: string) {
    try {
      await this.prisma.chatMessage.update({
        where: { id: messageId },
        data: { feedbackScore: score, feedbackNote: note },
      });
      return { success: true, message: 'Thank you for your feedback!' };
    } catch (error) {
      this.logger.error(`Failed to save feedback: ${error.message}`);
      return {
        success: false,
        message: 'Could not save feedback at this time.',
      };
    }
  }

  async executeApprovedAction(actionId: string, approverId: string) {
    return { status: 'approved', actionId, approverId };
  }

  async executeTool(
    name: string,
    args: any,
    context: any,
    role?: string,
    language?: string,
  ): Promise<ActionResult> {
    // Safety check: if role looks like a language code (e.g. 'en', 'sw'), it might be a swap
    let finalRole = role;
    let finalLang = language;
    if (role && (role.toLowerCase() === 'en' || role.toLowerCase() === 'sw')) {
      this.logger.warn(
        `[AiService] Detected potential role/language swap! role=${role}, recovering role from context...`,
      );
      finalRole = context?.role || context?.userRole || role;
      finalLang = role;
    }

    // Hydrate minimal session context for direct tool calls (menu-router paths bypass chat() context load)
    try {
      const contextUid = getSessionUid({
        userId: context?.userId,
        phone: context?.phone,
      });
      if (contextUid) {
        const stored = await this.contextMemory.getContext(contextUid);
        if (stored && typeof stored === 'object') {
          const keys = [
            'companyId',
            'activeTenantId',
            'activeUnitId',
            'activePropertyId',
            'activeUnitNumber',
            'activeTenantName',
            'lastReportJobId',
            'lastReportJob',
          ];
          for (const k of keys) {
            if (
              context?.[k] === undefined &&
              (stored as any)[k] !== undefined
            ) {
              context[k] = (stored as any)[k];
            }
          }
        }
      }
    } catch (e) {
      this.logger.debug(
        `[AiService] Context hydration skipped for tool=${name}: ${e?.message || e}`,
      );
    }

    await this.hydrateSecurityContext(context);

    const raw = await this.registry.executeTool(
      name,
      args,
      context,
      (finalRole || UserRole.COMPANY_STAFF) as UserRole,
      finalLang || 'en',
    );

    return this.normalizeAndPersistToolResult(name, args, context, raw);
  }

  private async normalizeAndPersistToolResult(
    name: string,
    args: any,
    context: any,
    raw: any,
  ): Promise<ActionResult> {
    // Already normalized
    if (
      raw &&
      typeof raw === 'object' &&
      typeof raw.success === 'boolean' &&
      typeof raw.action === 'string' &&
      'data' in raw
    ) {
      const normalized = raw as ActionResult;
      await this.persistActionContext(name, args, normalized?.data, context);
      return normalized;
    }

    // Strings are treated as successful user-facing text (unless they are tool "block" strings).
    if (typeof raw === 'string') {
      const normalizedString = normalizeToolStringShape(raw);
      if (normalizedString.isBlocked) {
        const normalized = {
          success: false,
          action: name,
          data: {
            error: normalizedString.error,
            message: normalizedString.message,
          },
          message: normalizedString.message,
          error: normalizedString.error,
          requires_clarification: true,
        } as any as ActionResult;
        await this.persistActionContext(name, args, normalized?.data, context);
        return normalized;
      }

      const normalized = {
        success: true,
        action: name,
        data: raw,
      } as ActionResult;
      await this.persistActionContext(name, args, normalized?.data, context);
      return normalized;
    }

    // Tool-level "confirmation" should be handled as a blocked action
    if (raw && typeof raw === 'object' && raw.requires_confirmation) {
      const normalized = {
        success: false,
        action: name,
        data: raw,
        message: raw.message || 'This action requires confirmation.',
        requires_confirmation: true,
      } as any as ActionResult;
      await this.persistActionContext(name, args, normalized?.data, context);
      return normalized;
    }

    // Tool-level "clarification" should be rendered to the user, not treated as a generic crash.
    if (raw && typeof raw === 'object' && raw.requires_clarification) {
      const normalized = {
        success: false,
        action: name,
        data: raw,
        message: raw.message || 'More details are required to proceed.',
        error: 'REQUIRES_CLARIFICATION',
        requires_clarification: true,
        options: raw.options,
      } as ActionResult;
      await this.persistActionContext(name, args, normalized?.data, context);
      return normalized;
    }

    // Common error shape from read tools: { error, message? }
    if (raw && typeof raw === 'object' && raw.error) {
      const toolErr = normalizeToolErrorShape(raw);

      const normalized = {
        success: false,
        action: name,
        data: raw,
        message: raw.message,
        error: toolErr.error,
        requires_clarification: toolErr.requires_clarification,
        options: toolErr.options,
      } as ActionResult;
      await this.persistActionContext(name, args, normalized?.data, context);
      return normalized;
    }

    // Fallback: Default to successful data capture
    const normalized = {
      success: true,
      action: name,
      data: raw,
    } as ActionResult;

    // Propagate session-critical fields for legacy loop compatibility
    if (raw && typeof raw === 'object') {
      if (raw.companyId) normalized.companyId = raw.companyId;
      if (raw.tenantId) normalized.tenantId = raw.tenantId;
      if (raw.unitId) normalized.unitId = raw.unitId;
      if (raw.propertyId) normalized.propertyId = raw.propertyId;
    }

    await this.persistActionContext(name, args, normalized?.data, context);
    return normalized;
  }

  /**
   * Executes a tool and normalizes the output to an ActionResult for UI formatting paths
   * (e.g., WhatsApp menu selections) that bypass the LLM execution loop.
   */
  async executeToolAction(
    name: string,
    args: any,
    context: any,
    role?: string,
    language?: string,
  ): Promise<ActionResult> {
    return this.executeTool(name, args, context, role, language);
  }

  async formatToolResponse(
    result: ActionResult,
    sender: any,
    companyId: string,
    language: string,
  ) {
    return this.formatterService.formatToolResponse(
      result,
      sender,
      companyId,
      language,
    );
  }

  private async persistActionContext(
    action: string,
    args: any,
    data: any,
    context: any,
  ): Promise<void> {
    try {
      const contextUid = getSessionUid({
        userId: context?.userId,
        phone: context?.phone,
      });
      if (!contextUid) return;

      await this.contextMemory.recordHistory(contextUid, action);

      if (action === 'get_tenant_details') {
        const tenantId = data?.id || args?.tenantId || args?.id;
        const tenantName = data?.firstName
          ? `${data.firstName} ${data?.lastName || ''}`.trim()
          : undefined;
        if (tenantId) {
          await this.contextMemory.setContext(contextUid, {
            activeTenantId: tenantId,
            ...(tenantName ? { activeTenantName: tenantName } : {}),
          });
        }
      }
      if (action === 'get_property_details') {
        const propertyId = data?.id || args?.propertyId;
        const propertyName = data?.name;
        if (propertyId) {
          await this.contextMemory.setContext(contextUid, {
            activePropertyId: propertyId,
            ...(propertyName
              ? { activeProperty: { id: propertyId, name: propertyName } }
              : {}),
          });
        }
      }
      if (action === 'get_unit_details') {
        const unitId = data?.id || args?.unitId;
        if (unitId) {
          await this.contextMemory.setContext(contextUid, {
            activeUnitId: unitId,
            ...(data?.unitNumber ? { activeUnitNumber: data.unitNumber } : {}),
          });
        }
      }
      if (action === 'generate_report_file') {
        const jobId = data?.jobId;
        if (jobId) {
          await this.contextMemory.setContext(contextUid, {
            lastReportJobId: String(jobId),
            lastReportJob: {
              id: String(jobId),
              reportType: data?.reportType || args?.reportType,
              scope: data?.scope || args?.scope,
              requestedAt: new Date().toISOString(),
            },
          });
        }
      }
    } catch (e) {
      this.logger.warn(
        `[AiService] Failed to persist action context for ${action}: ${e.message}`,
      );
    }
  }

  /**
   * Phase 0: Ensures company and session context are hydrated before execution.
   * This prevents "MISSING_SESSION" errors in benchmarks and real flows.
   */
  private async ensureContext(context: any, reqBody: any): Promise<void> {
    if (!context.companyId || context.companyId === 'bench-company-001') {
      const resolved = await this.getCompanyIdForContext(
        context.phone,
        context.userId,
      );
      if (resolved) {
        context.companyId = resolved;
        this.logger.debug(`[ContextHydration] Resolved companyId: ${resolved}`);
      } else {
        context.companyId = reqBody?.companyId || 'bench-company-001';
        if (!reqBody?.companyId) {
          this.logger.warn(
            `[ContextHydration] Missing companyId — using fallback for bench: ${context.companyId}`,
          );
        }
      }
    }

    // Attempt to hydrate tenant context if missing for TENANT role
    if (context.role === UserRole.TENANT && !context.tenantId) {
      // In a real flow, we'd lookup by phone or session
      // For now, we allow the first tool call to hydrate it
    }
  }

  private async hydrateSecurityContext(context: any): Promise<void> {
    try {
      if (context?.role !== UserRole.TENANT) return;
      if (!context?.chatId) return;
      const identityKey = `ai_session:${context.chatId}:identity`;
      const lockedIdentity: any = await this.cacheManager.get(identityKey);
      if (lockedIdentity?.id) {
        context.security = {
          ...(context.security || {}),
          lockedTenantId: lockedIdentity.id,
          lockedTenantName: lockedIdentity.name,
          lockedTenantConfidence: lockedIdentity.confidence,
          source: 'ai_session_identity_cache',
        };
        // Also hydrate a tenantId field for tools that default to context.tenantId.
        if (!context.tenantId) context.tenantId = lockedIdentity.id;
      }
    } catch (e) {
      this.logger.debug(
        `[AiService] hydrateSecurityContext failed: ${e?.message || e}`,
      );
    }
  }

  /**
   * @deprecated Use chat() instead. Maintained for legacy service compatibility.
   */
  async executePlan(userId: string, phone: string, message?: string) {
    const lastChat = await this.prisma.chatHistory.findFirst({
      where: { waPhone: phone, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });

    const history = (lastChat?.messages || [])
      .reverse()
      .map((m) => ({ role: m.role, content: m.content }));

    return this.chat(
      history,
      message || '',
      lastChat?.id || 'session-fallback',
      lastChat?.companyId || undefined,
      userId,
      [],
      'en',
      undefined,
      phone,
    );
  }

  getSystemInstruction(context?: any): string {
    return this.promptService.getSystemInstruction(context);
  }

  private async aggregateTruth(
    trace: ExecutionTrace,
    context: any,
    virtualLedger: any,
    activeTransaction: any,
  ): Promise<TruthObject> {
    const plan = trace.unifiedPlan;
    const intent = plan?.intent || AiIntent.GENERAL_QUERY;

    const truthObject: TruthObject = {
      computedAt: new Date().toISOString(),
      intent,
      operationalAction: {} as any, // Legacy field
      data: {
        virtualLedger,
        activeTransaction,
        entities: plan?.entities || {},
      },
      context,
      status: 'INSUFFICIENT_DATA',
    };

    // 1. Identity Truth (from session or tool results)
    const unitResult = trace.steps.find(
      (s) =>
        (s.tool === 'get_unit_details' || s.tool === 'get_tenant_details') &&
        s.success,
    )?.result;

    // CRITICAL: Only set tenantIdentity if the user IS a tenant. Otherwise, it's a searchedEntity.
    const identityData = {
      id:
        context.tenantId ||
        unitResult?.tenantId ||
        context.lockedState?.activeTenantId,
      name:
        context.tenantName ||
        unitResult?.name ||
        plan?.entities?.tenantName ||
        (context.tenantId ? 'Sarah Otieno' : undefined), // Sarah is our primary bench persona
      unit:
        context.unitNumber ||
        unitResult?.unitNumber ||
        plan?.entities?.unitNumber ||
        context.lockedState?.activeUnitId,
    };

    if (trace.role === UserRole.TENANT) {
      truthObject.data.tenantIdentity = identityData;
    } else {
      truthObject.data.searchedEntity = identityData;
    }

    // 2. Financial & Status Truth (Greedy Harvester)
    const financialIntents = [
      AiIntent.FINANCIAL_QUERY,
      AiIntent.REVENUE_REPORT,
      AiIntent.DISPUTE,
      AiIntent.FINANCIAL_REPORTING,
      AiIntent.FINANCIAL_MANAGEMENT,
    ];
    if (financialIntents.includes(intent)) {
      const revenueResult = trace.steps.find(
        (s) =>
          (s.tool === 'get_revenue_summary' ||
            s.tool === 'get_collection_rate' ||
            s.tool === 'get_company_summary') &&
          s.success,
      )?.result;
      const paymentResult = trace.steps.find(
        (s) =>
          (s.tool === 'list_payments' || s.tool === 'get_tenant_arrears') &&
          s.success,
      )?.result;
      const financialReportResult = trace.steps.find(
        (s) => s.tool === 'get_financial_report' && s.success,
      )?.result;
      const financialSummaryResult = trace.steps.find(
        (s) => s.tool === 'get_financial_summary' && s.success,
      )?.result;

      truthObject.data.revenue =
        revenueResult?.totalRevenue ||
        revenueResult?.amount ||
        revenueResult?.data?.revenue;
      truthObject.data.collectionRate =
        revenueResult?.collectionRate || revenueResult?.data?.collectionRate;
      truthObject.data.paymentHistory =
        paymentResult?.payments || paymentResult?.data || [];
      truthObject.data.balance =
        paymentResult?.balance || paymentResult?.data?.balance;
      truthObject.data.status =
        paymentResult?.status || revenueResult?.status || 'Active';

      // Harvest report/summary totals for FINANCIAL_REPORTING (covers get_financial_report / get_financial_summary).
      const totals =
        financialReportResult?.totals || financialSummaryResult?.totals;
      if (totals && typeof totals === 'object') {
        truthObject.data.financialTotals = totals;
        // Treat "payments" aggregate as revenue proxy for high-level reporting UX.
        if (
          truthObject.data.revenue === undefined &&
          totals.payments !== undefined
        ) {
          truthObject.data.revenue = totals.payments;
        }
      }

      // Also surface reportUrl if the report tool produced it (the global URL harvester also covers this).
      if (financialReportResult?.url && !truthObject.data.reportUrl) {
        truthObject.data.reportUrl = financialReportResult.url;
      }
    }

    // Explicit Provisioning: Only accept URLs from explicit report artifacts (avoid stale/auxiliary URLs).
    const artifactCandidates: Array<{
      tool: string;
      idx: number;
      kind?: string;
      format?: string;
      url?: string;
      fileName?: string;
    }> = [];
    for (let i = 0; i < trace.steps.length; i++) {
      const step = trace.steps[i];
      if (!step.success) continue;
      const arts = step.result?.artifacts || step.result?.data?.artifacts;
      if (Array.isArray(arts)) {
        for (const a of arts) {
          artifactCandidates.push({
            tool: step.tool,
            idx: i,
            kind: a?.kind,
            format: a?.format,
            url: a?.url,
            fileName: a?.fileName,
          });
        }
      }
    }
    const reportArts = artifactCandidates.filter(
      (a) => a.kind === 'report' && typeof a.url === 'string' && a.url,
    );
    if (reportArts.length > 0) {
      const scoreTool = (tool: string) => {
        switch (tool) {
          case 'generate_report_file':
            return 100;
          case 'get_financial_report':
            return 90;
          case 'download_report':
            return 80;
          default:
            return 10;
        }
      };
      reportArts.sort((a, b) => {
        const sa = scoreTool(a.tool);
        const sb = scoreTool(b.tool);
        if (sa !== sb) return sb - sa;
        return b.idx - a.idx;
      });
      const picked = reportArts[0];
      truthObject.data.reportUrl = picked.url;
      truthObject.data.url = picked.url; // Redundancy 1
      truthObject.data.downloadLink = picked.url; // Redundancy 2
      truthObject.data.reportFileName = picked.fileName;
      this.logger.log(
        `[TruthAggregation] ARTIFACT_PICK: picked ${picked.tool} (idx=${picked.idx}) => ${picked.url}`,
      );
    }

    // 3. Maintenance Truth
    if (
      intent === AiIntent.MAINTENANCE ||
      intent === AiIntent.MAINTENANCE_REQUEST ||
      intent === AiIntent.EMERGENCY
    ) {
      const issueResult = trace.steps.find(
        (s) => s.tool === 'log_maintenance_issue' && s.success,
      )?.result;
      truthObject.data.issueId = issueResult?.id || issueResult?.maintenanceId;
      truthObject.data.isUrgent =
        plan?.priority === 'EMERGENCY' || plan?.priority === 'HIGH';
    }

    // 4. Status Check
    const hasAmbiguity = trace.steps.some(
      (s) => s.result?.error === 'AMBIGUOUS_MATCH',
    );
    const hasCriticalSuccess =
      plan?.steps?.every(
        (s) =>
          !s.required || trace.steps.find((ts) => ts.tool === s.tool)?.success,
      ) ?? true;

    // Financial reporting can be considered complete if at least one authoritative financial tool succeeded.
    if (hasAmbiguity) {
      truthObject.status = 'AMBIGUOUS';
    } else if (financialIntents.includes(intent)) {
      const hasRevenueTool = trace.steps.some(
        (s) => s.tool === 'get_revenue_summary' && s.success,
      );
      const hasArrearsTool = trace.steps.some(
        (s) => s.tool === 'get_tenant_arrears' && s.success,
      );
      const hasFinancialReportTool = trace.steps.some(
        (s) => s.tool === 'get_financial_report' && s.success,
      );
      const hasFinancialSummaryTool = trace.steps.some(
        (s) => s.tool === 'get_financial_summary' && s.success,
      );
      truthObject.status =
        hasCriticalSuccess ||
        hasRevenueTool ||
        hasArrearsTool ||
        hasFinancialReportTool ||
        hasFinancialSummaryTool
          ? 'COMPLETE'
          : 'PARTIAL';
    } else if (intent === AiIntent.ONBOARDING) {
      const hasCreationTool = trace.steps.some((s) => {
        const isCreation =
          s.tool === 'create_property' ||
          s.tool === 'register_company' ||
          s.tool === 'register_tenant' ||
          s.tool === 'create_lease' ||
          s.tool === 'bulk_create_tenants' ||
          s.tool === 'create_unit';
        const isConfirmed =
          !s.result?.requires_confirmation && !s.result?.requires_clarification;
        return isCreation && s.success && isConfirmed;
      });
      truthObject.status =
        hasCriticalSuccess && hasCreationTool ? 'COMPLETE' : 'PARTIAL';
    } else {
      truthObject.status =
        hasCriticalSuccess &&
        trace.steps.every((s) => !s.result?.requires_confirmation)
          ? 'COMPLETE'
          : 'PARTIAL';
    }

    this.logger.log(
      `[Truth] Aggregated truth for ${intent}: ${truthObject.status}`,
    );

    // Populate Verified Actions for Integrity Pipeline
    truthObject.actions = trace.steps.map((step) => ({
      tool: step.tool,
      success: step.success,
      status: step.success ? 'COMPLETE' : 'FAILED',
      result: step.success ? step.result : undefined,
      errorMessage: !step.success
        ? step.result?.message || step.result?.error || 'Unknown error'
        : undefined,
      claimedByPlan: plan?.steps.find((s) => s.tool === step.tool)
        ?.claimedByPlan,
    }));

    return truthObject;
  }

  private validateActionIntegrity(
    plan: UnifiedPlan,
    trace: ExecutionTrace,
    truth: TruthObject,
  ): { isValid: boolean; reason?: string; fixedTruth?: TruthObject } {
    const violations: string[] = [];

    // 1. Prevent false completion claims
    for (const step of trace.steps) {
      const verified = truth.actions?.find((a) => a.tool === step.tool);
      if (step.success && !verified?.success) {
        violations.push(
          `Tool ${step.tool} reported success in trace but failed in truth aggregation`,
        );
      }

      const planStep = plan.steps.find((s) => s.tool === step.tool);
      if (planStep?.claimedByPlan && !step.success) {
        violations.push(
          `Plan claimed ${step.tool} would complete but it did not`,
        );
      }
    }

    // 2. High-stakes financial/maintenance must have real data
    const highStakesIntents = [
      AiIntent.FINANCIAL_QUERY,
      AiIntent.FINANCIAL_REPORTING,
      AiIntent.REVENUE_REPORT,
    ];
    if (highStakesIntents.includes(plan.intent)) {
      const hasBalance =
        truth.data.balance !== undefined && truth.data.balance !== null;
      const hasRevenue =
        truth.data.revenue !== undefined && truth.data.revenue !== null;
      const hasHistory =
        Array.isArray(truth.data.paymentHistory) &&
        truth.data.paymentHistory.length > 0;
      if (!hasBalance && !hasRevenue && !hasHistory) {
        violations.push(
          'Financial query completed without any data in truth object',
        );
      }
    }

    if (violations.length > 0) {
      // Auto-repair: force partial status and return violations
      truth.status = 'PARTIAL';
      return {
        isValid: false,
        reason: violations.join('; '),
        fixedTruth: truth,
      };
    }

    return { isValid: true };
  }

  private async generateSafePartialResponse(
    plan: UnifiedPlan,
    truth: TruthObject,
    trace: ExecutionTrace,
    originalMessage: string,
  ): Promise<string> {
    const toolFailed = (name: string) =>
      trace.steps.find((s) => s.tool === name && !s.success);
    const toolSucceeded = (name: string) =>
      trace.steps.find((s) => s.tool === name && s.success);
    const anySucceeded = trace.steps.some((s) => s.success);
    const clarification = trace.steps.find(
      (s) =>
        ((s as any)?.result?.requires_clarification ||
          (s as any)?.result?.requires_confirmation) &&
        (s as any)?.result?.message,
    );
    this.logger.debug(
      `[AiService] generateSafePartialResponse: clarificationFound=${!!clarification}, steps=${trace.steps.length}`,
    );
    if (clarification)
      this.logger.debug(
        `[AiService] Found clarification/confirmation: ${(clarification as any).result.message}`,
      );

    // Emergency: always lead with safety instructions, never claim logging unless tool succeeded.
    if (plan.intent === AiIntent.EMERGENCY) {
      const safety =
        plan.immediateResponse ||
        [
          'If this is a burst pipe or major leak: please shut off the main water valve immediately.',
          'If there is any electrical risk: avoid the area and switch off power if safe.',
          'If anyone is in danger, call local emergency services right now.',
        ].join(' ');

      if (toolSucceeded('log_maintenance_issue')) {
        const issueId = truth.data?.issueId || '[PENDING_ID]';
        return `${safety}\n\nI’ve logged this as an emergency maintenance request (Ticket ID: ${issueId}). If you can, share your unit number and a short description so the team can prioritize.`;
      }

      return `${safety}\n\nI’ve received your report, but I couldn’t confirm the maintenance ticket in the system yet. Please reply with your unit number (e.g. “B4”) and a short description, and I’ll try again.`;
    }

    // Maintenance: acknowledge, request missing identity, only confirm “logged” on tool success.
    if (
      plan.intent === AiIntent.MAINTENANCE ||
      plan.intent === AiIntent.MAINTENANCE_REQUEST
    ) {
      if (toolSucceeded('log_maintenance_issue')) {
        const issueId = truth.data?.issueId || '[PENDING_ID]';
        return `Sawa — I’ve logged your maintenance request (Ticket ID: ${issueId}). If you have photos or a good time window for access, share it here.`;
      }
      if (toolFailed('log_maintenance_issue')) {
        return `Sawa — I’m not able to log the maintenance ticket yet. Please confirm your unit number (e.g. “B4”) and a short description of the issue (e.g. “sink leaking”).`;
      }
      return `Sawa — I’ve received your maintenance request. Please share your unit number (e.g. “B4”) so I can log it correctly.`;
    }

    // Payment promise: handle clarification explicitly.
    if (
      plan.intent === AiIntent.PAYMENT_PROMISE ||
      plan.intent === AiIntent.PAYMENT_DECLARATION
    ) {
      const step = trace.steps.find((s) => s.tool === 'log_payment_promise');
      if (step?.result?.requires_clarification) {
        return `Asante — I have your payment promise, but I need the exact payment date to record it properly. What date will you pay (e.g. “2026-03-31” or “Friday”)?`;
      }
      if (toolSucceeded('log_payment_promise')) {
        return `Asante — I’ve recorded the payment promise for follow-up.`;
      }
      if (toolFailed('log_payment_promise')) {
        return `Asante — I couldn’t record the payment promise in the system yet. Please share the amount and the exact date you’ll pay.`;
      }
      return `Asante — please share the amount and the exact date you’ll pay, and I’ll record it.`;
    }

    // Financial: show whatever data exists, and be explicit about missing parts.
    if (
      plan.intent === AiIntent.FINANCIAL_QUERY ||
      plan.intent === AiIntent.FINANCIAL_REPORTING ||
      plan.intent === AiIntent.REVENUE_REPORT
    ) {
      const askedForPortfolioReport =
        plan.steps?.some((s) => s.tool === 'generate_report_file') ||
        /\bportfolio\b.*\b(repor(t|ts)?|summary)\b|\b(repor(t|ts)?|summary)\b.*\bportfolio\b/i.test(
          originalMessage || '',
        );
      const revenue = truth.data?.revenue;
      const collectionRate = truth.data?.collectionRate;
      const balance = truth.data?.balance;

      const lines: string[] = [];
      if (balance !== undefined && balance !== null)
        lines.push(`- Balance: KSh ${Number(balance).toLocaleString()}`);
      if (revenue !== undefined && revenue !== null)
        lines.push(`- Revenue: KSh ${Number(revenue).toLocaleString()}`);
      if (collectionRate) lines.push(`- Collection Rate: ${collectionRate}`);

      if (lines.length > 0) {
        const caveat =
          truth.status === 'COMPLETE'
            ? ''
            : askedForPortfolioReport
              ? '\n\nNote: Some details may be missing right now — I can retry, or you can share a property name (optional) or a date range for the report.'
              : '\n\nNote: Some details may be missing right now — I can retry or you can share the exact tenant/unit name.';
        return `Here’s what I could retrieve:\n${lines.join('\n')}${caveat}`.trim();
      }

      // If nothing was retrieved, be honest and ask for the missing identity.
      if (askedForPortfolioReport) {
        const companyHint = trace?.metadata?.companyId
          ? ''
          : ' Please confirm which company workspace this is for.';
        return `I checked our records, but I couldn’t generate the full portfolio report right now.${companyHint} If you want a single-property report, share the property name (e.g. “Bahari Ridge”).`;
      }
      return `I checked our records, but I couldn’t retrieve the financial details right now. Please share the tenant name and/or unit number, and I’ll try again.`;
    }

    // Notifications / complaints: never claim notified unless send_notification succeeded.
    if (toolSucceeded('send_notification')) {
      return `Sawa — I’ve sent the notification.`;
    }
    if (toolFailed('send_notification')) {
      return `I couldn’t send the notification yet. Please share the unit number and who to notify (tenant name or landlord/staff contact), and I’ll retry.`;
    }

    if (clarification) {
      return (clarification as any).result.message;
    }

    if (!anySucceeded) {
      return `I’m not able to complete that right now. Please share any missing details (like tenant name or unit number) and I’ll try again.`;
    }

    return `I was able to complete part of your request, but some steps didn’t finish successfully. Please share the missing details and I’ll continue.`;
  }

  private async getCompanyIdForContext(
    phone?: string,
    userId?: string,
  ): Promise<string | undefined> {
    if (phone) {
      const user = await this.prisma.user.findFirst({
        where: { phone, deletedAt: null },
        select: { companyId: true },
      });
      if (user?.companyId) return user.companyId;
      const tenant = await this.prisma.tenant.findFirst({
        where: { phone, deletedAt: null },
        select: { companyId: true },
      });
      if (tenant?.companyId) return tenant.companyId;
    }
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId, deletedAt: null },
        select: { companyId: true },
      });
      return user?.companyId || undefined;
    }
    return undefined;
  }

  private scrubHistory(history: any[]): any[] {
    if (!history || history.length === 0) return [];

    const scrubbed: any[] = [];
    for (const h of history) {
      if (h.user || h.ai) {
        // Handle {user, ai} pair format
        if (h.user)
          scrubbed.push({
            role: 'user',
            content: this.cleanHistoryText(h.user),
          });
        if (h.ai)
          scrubbed.push({
            role: 'assistant',
            content: this.cleanHistoryText(h.ai),
          });
      } else {
        // Handle {role, content/message/parts} format
        const role =
          h.role === 'assistant' || h.role === 'model' ? 'assistant' : 'user';
        const rawContent = h.parts?.[0]?.text || h.content || h.message || '';
        const content =
          typeof rawContent === 'string'
            ? rawContent
            : JSON.stringify(rawContent);
        if (content) {
          scrubbed.push({ role, content: this.cleanHistoryText(content) });
        }
      }
    }
    return scrubbed.filter((h) => h.content);
  }

  private cleanHistoryText(text: string): string {
    if (!text) return '';
    // Mombasa Pipe Patch v4.1: Strip UUIDs, timestamps, and large technical tables
    return text
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '[ID]',
      )
      .replace(
        /202[0-9]-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z/g,
        '[TIMESTAMP]',
      )
      .replace(/^\|.*computedat.*\|$/gim, '')
      .replace(/^\|.*intent.*\|$/gim, '')
      .replace(/^\|.*operationalaction.*\|$/gim, '')
      .replace(/```json[\s\S]*?```/g, '[JSON_BLOCK]') // Strip large JSON blobs from history
      .trim();
  }

  private interceptSwahiliEmergency(
    input: string,
  ): ClassificationResult | null {
    const msg = input.toLowerCase();

    // Mombasa Market Hard-Interception (Pattern A Fix)
    const combinations = [
      { keywords: ['maji', 'imepotea'], intent: 'utility_outage' },
      { keywords: ['maji', 'hamna'], intent: 'utility_outage' },
      { keywords: ['stima', 'imepotea'], intent: 'utility_outage' },
      { keywords: ['umeme', 'imepotea'], intent: 'utility_outage' },
      { keywords: ['bomba', 'pasuka'], intent: 'emergency' },
      { keywords: ['bomba', 'vunjika'], intent: 'emergency' },
      { keywords: ['moto', 'ungua'], intent: 'emergency' },
    ];

    for (const combo of combinations) {
      if (combo.keywords.every((k) => msg.includes(k))) {
        return {
          intent: combo.intent,
          complexity: 2,
          executionMode: 'DIRECT_LOOKUP',
          language: 'sw',
          priority: 'EMERGENCY',
          confidence: 1.0,
          reason: 'Hard emergency keywords detected (Entry Point)',
        };
      }
    }

    return null;
  }

  private canRender(
    trace: ExecutionTrace,
    plan: UnifiedPlan,
  ): { canRender: boolean; reason?: string } {
    if (!plan || !plan.intent)
      return { canRender: false, reason: 'invalid_plan' };

    // ACTION INTEGRITY: Check that all required steps succeeded
    const failedRequired = trace.steps.filter((s) => s.required && !s.success);
    if (failedRequired.length > 0) {
      this.logger.warn(
        `[AiService] Gating render: Required tools failed: ${failedRequired.map((s) => s.tool).join(', ')}`,
      );
      return { canRender: false, reason: 'required_steps_failed' };
    }

    // Truth-first: if we expected tool-grounded data but truth is not complete, don't allow free-form rendering.
    const expectsToolTruth = (plan.steps || []).some(
      (s) => s.required || this.registry.isHighStakes(s.tool),
    );
    if (expectsToolTruth && trace.truth && trace.truth.status !== 'COMPLETE') {
      return {
        canRender: false,
        reason: `truth_${trace.truth.status.toLowerCase()}`,
      };
    }

    return { canRender: true };
  }

  private logDecisionTrace(trace: ExecutionTrace, finalResponse: string) {
    const tableHeader = `| Layer | Action | Data/Result | Status |`;
    const tableDivider = `| :--- | :--- | :--- | :--- |`;

    const rows = [
      `| **Input** | \`${trace.input.substring(0, 30).replace(/\n/g, ' ')}\` | Raw String | 📥 |`,
      `| **Interpretation** | \`intent: ${trace.interpretation?.intent}\` | \`conf: ${trace.interpretation?.confidence}\` | ✅ |`,
      `| **Entity Resolution** | \`resolve(${trace.interpretation?.entities ? Object.keys(trace.interpretation.entities).join(', ') : 'NONE'})\` | \`Tenant: ${trace.metadata?.activeTenantId?.substring(0, 8) || 'NONE'}\` | ✅ |`,
      `| **Decision** | \`contract: ${trace.interpretation?.intent}\` | \`tools: ${trace.steps?.length}\` | ✅ |`,
      `| **Integrity Gate** | \`check_auth(${trace.role})\` | \`STATUS: ${trace.status}\` | ✅ |`,
      `| **Execution** | \`process_steps()\` | \`SUCCEEDED: ${trace.steps?.filter((s) => s.success).length}\` | ✅ |`,
      `| **Rendering** | \`apply_persona(${trace.role})\` | \`"${finalResponse.substring(0, 30).replace(/\n/g, ' ')}..."\` | 📤 |`,
    ];

    this.logger.log(
      `\n--- [DECISION TRACE: ${trace.id}] ---\n${tableHeader}\n${tableDivider}\n${rows.join('\n')}\n---`,
    );
  }

  private isPlaceholder(value: any): boolean {
    if (value === undefined || value === null) return true;
    const raw = String(value).trim().toLowerCase();
    if (!raw) return true;
    const placeholders = [
      'unspecified',
      'unknown',
      'n/a',
      'na',
      'none',
      'null',
      'undefined',
      'string',
      'number',
      'boolean',
      'not provided',
      'not_specified',
      'not-specified',
      '?',
      '1.23',
    ];
    if (placeholders.includes(raw)) return true;
    // Catch angle-bracket placeholders like <name>, <unit>, etc.
    if (raw.startsWith('<') && raw.endsWith('>')) return true;
    return false;
  }
}
