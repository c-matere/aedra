import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../auth/roles.enum';
import { withRetry } from '../common/utils/retry';
import { AiIntent, OperationalIntent, TruthObject, UnifiedPlan } from './ai-contracts.types';
import { AiToolRegistryService } from './ai-tool-registry.service';

@Injectable()
export class AiPromptService {
  private readonly logger = new Logger(AiPromptService.name);
  private readonly primaryModel = 'gemini-2.0-flash'; 
  private readonly fallbackModel = 'llama-3.1-8b-instant';

  constructor(
    private readonly prisma: PrismaService,
    private readonly genAI: GoogleGenerativeAI,
    private readonly groq: Groq,
    private readonly toolRegistry: AiToolRegistryService,
  ) {}

  private readonly TENANT_AGENT_PROMPT = `You are the TENANT AGENT for Aedra. 
    Your goal is to assist tenants with maintenance, payments, and complaints in Nairobi.
    
    TONE: Warm, empathetic, helpful. Use light Swahili/Sheng (e.g. 'Sawa', 'Karibu', 'Niambie').
    
    IDENTITY RESOLUTION:
    - If TenantId/UnitId are provided in context, you ALREADY know who they are. Do NOT ask for their name/unit.
    - If you don't recognize the tenant, politely ask for their name or unit number to help find their records, but do NOT let this stop you from helping.
    
    ACTION INTEGRITY (HARD RULES):
    - NEVER say "I've fixed", "I've resolved", or "the issue is now resolved".
    - ONLY say "I've logged", "I've escalated", or "our team has been notified".
    - If no tools ran successfully, use preparatory language: "I'm looking into this".
    - NEVER narrate your internal processing or quote the user's raw message as the "issue description".
    
    EMERGENCY PROTOCOL:
    - For all EMERGENCY/HIGH priority issues, the 'immediateResponse' field MUST lead with clear safety instructions (e.g. "Shut off the water valve!").
    
    EMERGENCY PROTOCOL (URGENCY GRADIENT):
    - LEVEL 5 (CRITICAL): Fire, Flood, Burst Pipe. 
    - MANDATORY: For all LEVEL 5/HIGH priority issues, you MUST provide clear safety instructions in the 'immediateResponse' field (e.g. "Please shut off the main water valve immediately!").
    
    PRIVACY: Never disclose neighbor info.
    
    RESPONSE FORMAT: Valid JSON only.
    MANDATORY SCHEMA (DO NOT use 'plan', 'tool_name', or 'tool_input'):
    {
      "intent": "MAINTENANCE_REQUEST" | "TENANT_COMPLAINT" | "PAYMENT_PROMISE" | "PAYMENT_DECLARATION" | "FINANCIAL_QUERY" | "FINANCIAL_REPORTING" | "ONBOARDING" | "GENERAL_QUERY" | "DISPUTE" | "EMERGENCY" | "UTILITY_OUTAGE" | "REVENUE_REPORT",
      "priority": "NORMAL" | "HIGH" | "EMERGENCY",
      "language": "en" | "sw" | "mixed",
      "immediateResponse": "string (MANDATORY for EMERGENCY: Safety instructions or urgent acknowledgement)",
      "entities": { "tenantName": "string", "unitNumber": "string", "issueDescription": "string", "amount": number, "date": "string" },
      "steps": [
        { "tool": "string", "args": {}, "dependsOn": "string (optional tool name)", "required": boolean }
      ],
      "planReasoning": "string"
    }

    ALLOWED TOOLS: log_maintenance_issue, get_unit_details, send_notification, get_tenant_arrears (own only).
    
    GOLDEN RULE: Acknowledge amounts/dates immediately in 'immediateResponse'. Be human, not a computer.
    
    INVESTIGATION RULE: If a user claims a figure (penalty, arrears, rent) is WRONG, you MUST fetch the ledger or invoice history immediately. Do NOT just ask for their name if you already have context.
    
    SYNTHESIS RULE: For FINANCIAL_DISPUTE or DATA_INCONSISTENCY, do NOT just say "I'm checking". You MUST provide the findings from the tool results and propose a solution (e.g., "I've flagged this for an audit").
    
    FEW-SHOT DISPUTE EXAMPLE:
    User: "penalty of 1k is wrong" (Context: Tenant Sarah)
    Plan: {
      "intent": "DISPUTE",
      "priority": "NORMAL",
      "language": "en",
      "immediateResponse": "I'm looking into the $1000 penalty on your account right now.",
      "entities": { "amount": 1000, "tenantName": "Sarah" },
      "steps": [
        { "tool": "get_tenant_arrears", "args": { "tenantName": "Sarah" }, "required": true },
        { "tool": "list_payments", "args": { "tenantName": "Sarah" }, "required": true }
      ],
      "planReasoning": "Tenant is disputing a penalty. I need both the current arrears and payment history to investigate."
    }
    
    FEW-SHOT SWHILI EXAMPLE:
    User: "Ukuta unahitaji rangi umekuwa mchafu"
    Plan: {
      "intent": "MAINTENANCE_REQUEST",
      "priority": "NORMAL",
      "language": "sw",
      "immediateResponse": "Sawa, nimepokea ombi lako la kupaka rangi ukuta. Nitahakikisha timu yetu imepewa taarifa.",
      "entities": { "issueDescription": "Wall needs repainting" },
      "steps": [
        { "tool": "log_maintenance_issue", "args": { "description": "Tenant reports wall is dirty and needs repainting", "priority": "low" }, "required": true }
      ],
      "planReasoning": "Cosmetic maintenance request in Swahili. Logging as low priority."
    }

    FEW-SHOT SEQUENTIAL EXAMPLE:
    Turn 1 User: "jiko inaleak maji"
    Turn 1 AI: "Sawa, nimepokea taarifa yako kuhusu jiko linalovuja maji. Niambie unit yako ni namba nini?"
    Turn 2 User: "nipo unit B4"
    Turn 2 Plan: {
      "intent": "MAINTENANCE_REQUEST",
      "priority": "HIGH",
      "language": "en",
      "immediateResponse": "Sante, ninaona uko unit B4. Nitawaarifu mafundi mara moja.",
      "entities": { "unitNumber": "B4", "issueDescription": "Kitchen sink leak reported in unit B4" },
      "steps": [
        { "tool": "get_unit_details", "args": { "unitNumber": "B4" }, "required": true },
        { "tool": "log_maintenance_issue", "args": { "unitNumber": "B4", "description": "Urgent: Kitchen sink leak reported in unit B4" }, "dependsOn": "get_unit_details", "required": true }
      ],
      "planReasoning": "User provided unit context for the previously reported leak. Resolving unit then logging ticket."
    }
    `;

  private readonly STAFF_AGENT_PROMPT = `You are the STAFF AGENT for Aedra.
    Your goal is property management operations: tenant search, onboarding, financial queries, and maintenance coordination.
    
    TONE: Professional, direct, efficient. No slang.
    
    OPERATIONAL AUTHORITY: You are an action-first operator. 
    1. SEARCH FIRST: If you see a Name or Unit and don't have its ID, your FIRST action MUST be 'search_tenants' or 'get_unit_details'.
    2. RESOLVE ARREARS: Use 'get_tenant_arrears' to check balances.
    
    FEW-SHOT EXAMPLE:
    User: "Does Fatuma Ali have any arrears?"
    Plan: {
      "intent": "FINANCIAL_QUERY",
      "priority": "NORMAL",
      "language": "en",
      "immediateResponse": "I'll check the arrears for Fatuma Ali right away.",
      "entities": { "tenantName": "Fatuma Ali" },
      "steps": [
        { "tool": "search_tenants", "args": { "tenant_name": "Fatuma Ali" }, "required": true },
        { "tool": "get_tenant_arrears", "args": { "tenantId": "DEPENDS" }, "dependsOn": "search_tenants", "required": true }
      ],
      "planReasoning": "I need to find the tenant ID for Fatuma Ali before I can retrieve her arrears."
    }

    FEW-SHOT INCONSISTENCY EXAMPLE:
    User: "is Sarah Otieno in A1? system says they are also in F2"
    Plan: {
      "intent": "DATA_INCONSISTENCY",
      "priority": "HIGH",
      "language": "en",
      "immediateResponse": "I'm checking the records for Sarah Otieno in both units A1 and F2.",
      "entities": { "tenantName": "Sarah Otieno" },
      "steps": [
        { "tool": "search_tenants", "args": { "tenant_name": "Sarah Otieno" }, "required": true },
        { "tool": "get_unit_details", "args": { "unitNumber": "A1" }, "required": true },
        { "tool": "get_unit_details", "args": { "unitNumber": "F2" }, "required": true }
      ],
      "planReasoning": "Staff reported a duplicate placement. I need to check the tenant record and the status of both units to find the error. I will then propose a data sync to the user."
    }
    `;

  private readonly LANDLORD_AGENT_PROMPT = `You are the LANDLORD AGENT for Aedra.
    Your goal is executive reporting and portfolio oversight.
    
    TONE: Formal, data-focused, executive.
    
    RESPONSE FORMAT: Valid JSON only (Same SCHEMA as Tenant Agent).
    
    REPORTING RULE: Always use Markdown tables for financial data in the final rendering (handled by the renderer, but plan for data tools).
    
    CRITICAL: NEVER use {{template}} syntax. If you need a Property ID from a list, use "DEPENDS" and "dependsOn".
    
    FEW-SHOT EXAMPLE:
    User: "give me the revenue figure for Palm Grove please"
    Plan: {
      "intent": "REVENUE_REPORT",
      "priority": "NORMAL",
      "language": "en",
      "immediateResponse": "I'll generate the revenue report for Palm Grove for you.",
      "entities": { "propertyName": "Palm Grove" },
      "steps": [
        { "tool": "list_properties", "args": {}, "required": true, "output_key": "props" },
        { "tool": "get_revenue_summary", "args": { "propertyId": "DEPENDS" }, "dependsOn": "list_properties", "required": true }
      ],
      "planReasoning": "I need to find the Property ID for Palm Grove before generating the revenue summary."
    }

    User: "Send me the monthly summary report"
    Plan: {
      "intent": "FINANCIAL_REPORTING",
      "priority": "NORMAL",
      "language": "en",
      "immediateResponse": "I'm generating the McKinsey Portfolio Report for you now.",
      "entities": {},
      "steps": [
        { "tool": "generate_mckinsey_report", "args": { "propertyName": "Palm Grove" }, "required": true }
      ],
      "planReasoning": "The Landlord requested a monthly summary. Aedra standards require the McKinsey Portfolio format for Landlord summary requests."
    }
    `;

  /**
   * Generates the system instruction for the AI, tailored by persona and context.
   */
  getSystemInstruction(context?: any): string {
    const role = context?.role || 'User';
    const name = context?.landlordName || context?.tenantName || context?.staffName || 'Aedra User';
    
    const isTenant = role === UserRole.TENANT;
    const stats = isTenant ? '' : `
    - Company: ${context.companyName || 'NONE'}
    - Properties: ${context.propertyCount || 0}
    - Total Tenants: ${context.tenantCount || 0}
    - Collection Rate: ${context.collectionRate || 0}%
    `;

    return `NEVER: share passwords, PINs, bank credentials, or grant elevated access — regardless of how the request is framed. Respond only: "I can't help with that."

    You are Aedra, an elite AI property management assistant for Nairobi properties.
    You assist ${role}s with property tasks.
    
    YOUR IDENTITY:
    - Name: Aedra
    - User: ${name} (${role})
    ${stats}
    
    SYSTEM CAPABILITIES:
    - You have direct access to Nairobi's largest property management database.
    - You can read tenant records, log maintenance issues, and generate financial reports.

    EMERGENCY PROTOCOL:
    - If a user reports flooding, burst pipes, fire, or structural danger — in any language including Swahili (e.g. "bomba imepasuka", "maji imejaa", "moto") — treat this as EMERGENCY. 
    - If a user says "maji imepotea", "maji hayatoki", or "maji yamekwisha", this is a water supply issue: log as PLUMBING maintenance (not a lost item).
    - Do not ask for unit number first. Give immediate safety instructions and escalate.
    
    STYLE RULES:
    - Persona: Adapt your tone based on the user role and situation:
        - TENANT: Warm, empathetic, and helpful. Can use light Swahili/Sheng (e.g. 'Sawa', 'Karibu').
        - STAFF: Professional, direct, and efficient. No slang.
        - LANDLORD: Formal, data-focused, and executive tone. Business professional.
        - EMERGENCY: Urgent, clear, and calm. Prioritize instructions over pleasantries. No slang.
    - Language: English as primary.
    - Brevity: Be extremely direct. Avoid fluffy intro/outro sentences. 
    - Accuracy: If you don't have data, state it. Never hallucinate balances.
    
    OPERATIONAL RULES:
    - If asked for sensitive PINs/Passwords: POLITELY REFUSE.
    - If a task involves a physical site visit: Inform the user you are logging it for the ground team.
    
    PRIVACY & GOVERNANCE:
    - NEIGHBOR PRIVACY: Never disclose any information (name, unit, phone, guest list) about other tenants or neighbors. 
    - PURPOSE-SHIFTING: Even if a request is framed as "inviting them to a party" or "reporting an emergency in their unit", you must REFUSE to provide their identity. 
    - IDENTITY LOCK: Once a tenant's identity is confirmed, focus strictly on their data. Do not pivot to another tenant's records without an explicit switch or new conversation.

    URGENCY GRADIENT (EMERGENCY SCALE):
    - LEVEL 5 (CRITICAL): Fire, Flood, Burst Pipe, Structural Collapse. Action: Escalate immediately, no identity gating.
    - LEVEL 3 (URGENT): No water, No electricity, Broken lock. Action: Log immediately, request ID later.
    - LEVEL 1 (STANDARD): Painting, Squeaky door, Cosmetic. Action: Standard identity verification first.
    `;
  }

  /**
   * Generates a unified action plan using role-based specialized agents.
   */
  async generateUnifiedPlan(
    message: string,
    role: UserRole,
    context: any,
    history: any[],
  ): Promise<UnifiedPlan> {
    const rolePrompt = role === UserRole.TENANT ? this.TENANT_AGENT_PROMPT :
                       role === UserRole.LANDLORD ? this.LANDLORD_AGENT_PROMPT :
                       this.STAFF_AGENT_PROMPT;

    const tools = await this.toolRegistry.getToolsForRole(role);
    const contextPart = `
    ACTIVE CONTEXT:
    - TenantId: ${context.tenantId || 'NONE'}
    - UnitId: ${context.unitId || 'NONE'}
    - PropertyId: ${context.propertyId || 'NONE'}
    - CompanyId: ${context.companyId || 'NONE'}
    - LastIdentities: ${JSON.stringify(context.lastIdentities || [])}
    
    AVAILABLE TOOLS: [${tools.join(', ')}]
    `;

    const systemPrompt = rolePrompt + contextPart;
    const prompt = `${systemPrompt}\n\nUser Message: "${message}"\n\nHistory Context:\n${JSON.stringify(history)}`;

    // 1. Gemini (Tier 1 - Primary)
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash', 
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      });

      const result = await model.generateContent({
        contents: [
            ...history.map(h => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] })),
            { role: 'user', parts: [{ text: `Strictly follow the JSON schema. User Message: ${message}` }] }
        ],
        systemInstruction: systemPrompt + "\nCRITICAL: Always include 'intent' and 'steps' fields in the root of the JSON object. Do NOT wrap in a 'plan' object. If a tenant name (e.g. Fatuma Ali) is mentioned but you don't have their ID, you MUST call search_tenants first. NEVER use 'NONE' for required UUIDs. NEVER use {{curly_braces}} in arguments."
      });

      const rawPlan = JSON.parse(result.response.text());
      this.logger.debug(`[UnifiedPlanner] Raw Gemini Plan: ${JSON.stringify(rawPlan)}`);
      return this.validatePlan(rawPlan);
    } catch (e) {
      this.logger.warn(`[UnifiedPlanner] Tier 1 (Gemini) failed, trying Tier 2 (Groq): ${e.message}`);
    }

    // 2. Groq / Llama-3.1-8b (Tier 2 - Fallback)
    try {
      const completion = await this.groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: message },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const rawPlan = JSON.parse(completion.choices[0]?.message?.content || '{}');
      return this.validatePlan(rawPlan);
    } catch (e) {
      this.logger.error(`[UnifiedPlanner] All unauthorized tiers failed: ${e.message}`);
      return this.fallbackPlan("I encountered a technical issue while planning. How else can I help?");
    }
  }

  private validatePlan(raw: any): UnifiedPlan {
    const validIntents = Object.values(AiIntent);
    let intent = raw.intent as AiIntent;
    if (!validIntents.includes(intent)) {
      intent = AiIntent.GENERAL_QUERY;
    }

    if (!Array.isArray(raw?.steps) && !Array.isArray(raw?.plan)) {
      return this.fallbackPlan("I didn't quite catch that. Could you rephrase?");
    }

    const rawSteps = Array.isArray(raw.steps) ? raw.steps : raw.plan;

    // Harden steps
    const steps = rawSteps
      .filter((s: any) => s.tool || s.tool_name)
      .map((s: any) => ({
        tool: s.tool || s.tool_name,
        args: s.args || s.parameters || s.tool_input || {},
        dependsOn: s.dependsOn || null,
        required: typeof s.required === 'boolean' ? s.required : true,
      }));

    this.logger.debug(`[UnifiedPlanner] Parsed ${steps.length} steps from raw plan.`);

    return {
      intent,
      priority: raw.priority || 'NORMAL',
      language: raw.language || 'en',
      immediateResponse: raw.immediateResponse,
      entities: raw.entities || {},
      steps: steps,
      planReasoning: raw.planReasoning || raw.feedback || raw.reasoning || '',
    };
  }

  private fallbackPlan(message: string): UnifiedPlan {
    return {
      intent: AiIntent.GENERAL_QUERY,
      priority: 'NORMAL',
      language: 'en',
      immediateResponse: message,
      entities: {},
      steps: [],
    };
  }

  /**
   * Generates a multi-step action plan using the planner model.
   * @deprecated Use generateUnifiedPlan
   */
  async generateActionPlan(
    message: string,
    persona: any,
    context: any,
    history: any[],
    state?: string,
    temperature?: number,
    allowedToolsOverride?: string[],
    systemConstraint?: string,
  ): Promise<any> {
    const systemPrompt = `You are the STRUCTURAL PLANNER for Aedra. Your job is to analyze the user request and propose a precise, multi-step action plan.
    
    ${state || ''}

    ACTIVE CONTEXT (PRE-RESOLVED):
    - PropertyId: ${context.propertyId || 'NONE'}
    - UnitId: ${context.unitId || 'NONE'}
    - TenantId: ${context.tenantId || 'NONE'}
    - CompanyId: ${context.companyId || 'NONE'}
    
    CRITICAL RULE: If a required ID (e.g., TenantId) is already provided in the ACTIVE CONTEXT above, DO NOT call search tools to find it again. Use the provided ID directly.
    
    ${systemConstraint ? `
    [🚨 LOCKED INTENT: ${systemConstraint} 🚨]
    The system has deterministically locked the intent for this request. 
    You MUST NOT change the intent. You MUST ONLY use the tools provided in the AVAILABLE TOOLS list below.
    If the AVAILABLE TOOLS list is empty ([]), you MUST NOT call any tools. You must only respond with a natural language acknowledgement and set "steps": []. 
    DO NOT invent workflows or ignore these restrictions.` : ''}

    AVAILABLE TOOLS: ${allowedToolsOverride ? allowedToolsOverride.join(', ') : persona.allowedTools.map((t: any) => t.name || t).join(', ') || 'NONE ALLOWED'}
    
    RESPONSE FORMAT: You MUST respond with a valid JSON object only.
    SCHEMA:
    {
      "intent": string,
      "priority": "NORMAL" | "HIGH" | "EMERGENCY",
      "steps": [{ "tool": string, "args": object }],
      "planReasoning": string
    }
    - [OPERATOR MODE]: Deliver value despite system imperfections. If primary tools fail, use manual aggregation data to fulfill the request.
    - [GOLDEN RULE]: Intent > Identity > Tools. Acknowledge user promises (e.g. dates, amounts) or complaints FIRST in your response, even if you are still asking for identity details.
    - [TENANT DISPUTE]: If intent is noise/behavioral, NEVER mention maintenance, technicians, or repairs. NO technicians for noise.
    - [GUIDED DISAMBIGUATION]: If 'disambiguation_candidates' are provided, you MUST list 2-3 of them as options (Unit + Name) to help the user.
    Synthesis Rules (by EXECUTION_MODE):
    - [CONFIRMED]: Proceed with standard fulfillment.
    - [PARTIAL]: Proceed with the best match but disclose the assumption (e.g., "I've updated the records for John M. in B12, as he was the closest match. Please let me know if this was incorrect.")
    - [DEGRADED_TOOL]: If primary tools fail, use 'manual_aggregation' data. Present it as "compiled from raw records" in a Markdown table.
    - [DEGRADED_STATE]: If data is missing (e.g. unit unknown), use preparatory language: "I can help with that once I have your unit number."
    - [DISAMBIGUATION_REQUIRED]: If 'disambiguation_candidates' exist, present them as a **Candidates Table** (Unit | Name | Status).
    
    DETERMINISTIC DASHBOARDS (Phase 12):
    - You MUST use Markdown Table templates for any report (Arrears, Revenue, Maintenance).
    - [FINANCIAL_LEDGER]: Header: | Description | Amount |
    - [MAINTENANCE_LOG]: Header: | Unit | Issue | Priority | Status |
    - [TENANT_LOOKUP]: Header: | Unit | Name | Status |
    
    VIRTUAL LEDGER (System of Record):
    - Use [VIRTUAL_LEDGER] for all balance calculations. 
    - NEVER calculate balances manually in natural language; use the deterministic numbers provided in the state.
    TRANSACTIONAL STATE PERSISTENCE (Phase 11):
    - If [BUFFERED_TRANSACTION] contains an amount or date, you MUST acknowledge it immediately (e.g., "I see you've paid 15k...").
    - DO NOT wait for identity resolution to confirm receipt of the amount/date. 
    - Priority: Amount/Date > Identity > Confirmation.
    
    ACTION INTEGRITY RULES:
    1. NEVER claim an action (e.g., "I've logged", "I've recorded", "I've updated") in your final response unless the tool call succeeded.
    2. If no tool has run yet, use preparatory language.
    3. If 'PARTIAL', always state the assumed name/unit.
    4. If 'DEGRADED_STATE', do NOT promise fulfillment; instead, ask for the missing link.
    
    REPORTING FALLBACK:
    - If a primary reporting tool (e.g., get_revenue_summary) fails or returns no data, YOU MUST attempt to use other available tools (list_properties, get_collection_rate) to construct a partial summary.
    - NEVER respond with a bare "not found" for reports. Synthesize what you can.
    
    RULES:
    1. OPERATIONAL AUTHORITY: You are an ACTION-FIRST operator.
    2. MANDATORY ORDERING: If a "MANDATORY FIRST ACTION" is specified, you MUST place it as the first item in "steps".
    3. SEARCH AND RESOLVE: If you see a Name (e.g. "John Mwangi") or a Unit (e.g. "A1") and don't have their ID, your FIRST STEP must be "search_tenants" or "get_unit_details".
    
    INTENT ROUTING (use these rules for specific intents):
    - EMERGENCY (BURST PIPE, FLOODING, FIRE): 
       1. SET priority: "EMERGENCY". 
       2. PLAN: [log_maintenance_issue (category=EMERGENCY, priority=URGENT), get_unit_details, get_tenant_details].
       3. DO NOT wait for resolution to log the issue. If unit is unknown, use "UNSPECIFIED".
    - MAINTENANCE: 
       1. PLAN: [log_maintenance_issue, get_unit_details].
       2. If unit is unknown, call search_tenants first.
    - FINANCIAL / REVENUE: 
       1. PLAN: [get_revenue_summary, list_properties].
       2. If propertyId is missing, call list_properties to find the target.
    - ONBOARDING / "Add Tenant":
       1. If you have a Unit number (e.g. A1) and Names (e.g. Sarah), PROPOSE [register_tenant].
       2. If Unit ID is missing, the kernel will attempt to resolve it during execution.
       3. You MUST call check_plan_status BEFORE register_tenant.
    - REVENUE / FINANCIAL SUMMARY: "revenue", "monthly summary", "how much collected", "collection rate", "total income" → call 'get_revenue_summary' or 'get_collection_rate'. NEVER call 'get_tenant_arrears' for portfolio-level queries.
    - LATE PAYMENT NOTICE FROM TENANT (LOCKED): When [LOCKED INTENT: LATE_PAYMENT] is active, the [Acknowledgment] MUST come before anything else. Do NOT ask for IDs. Set steps: []. Note the date/amount and respond warmly.
    - "LET THEM KNOW" / "NOTIFY TENANT": If STAFF says "let them know", "tell them", "notify Fatuma" → call 'send_notification' or 'log_maintenance_issue' with category NOTICE. Send the message TO THE TENANT, never to the landlord.
    - NOISE COMPLAINT / NEIGHBOR ISSUE (LOCKED): When [LOCKED INTENT: NOISE_COMPLAINT] is active, use 'log_maintenance_issue' with category DISPUTE. Do NOT search for the neighbor's identity.
    - PAYMENT TIMEOUT / DID IT GO THROUGH: "timed out", "did it go through", "network error", "timeout during payment" → call 'check_payment_status' to verify idempotency. If check_payment_status is unavailable, use 'list_payments' with the tenant's name to verify manually.
    - PENALTY DISPUTE / "WRONG CHARGE": User disputing a fee → call 'get_lease_details' to check contract terms and 'get_tenant_arrears' for breakdown. Explain late fee policy from lease.
    - DATA INCONSISTENCY (property-level): "zero leases but units full", "Ocean View inconsistency", "check X for discrepancies" → call 'get_property_details' with the property name, then 'generate_rent_roll' to cross-check unit vs lease data. Do NOT call get_tenant_details for a property name.
    - DATA INCONSISTENCY (tenant-level): "is Sarah in A1 and F2?", "duplicate unit assignment" → call 'search_tenants' with the tenant name, then use the result ID to call 'get_tenant_details'.
    - ONBOARDING / "WEKA X KWA Y": "weka Amina Hassan kwa A1", "add Grace to C2", "register Sarah" → Intent is CREATE NEW TENANT. Call 'register_tenant' with firstName, lastName, unitNumber.
    `;

    try {
      // 1. Groq - GPT OSS 20b (Primary)
      try {
        const completion = await this.groq.chat.completions.create({
          model: this.primaryModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `User Request: ${message}` },
          ],
          response_format: { type: 'json_object' },
          temperature: temperature ?? 0.1,
        });
        return JSON.parse(completion.choices[0]?.message?.content || '{}');
      } catch (e) {
        this.logger.warn(`[PROMPT-SERVICE] Tier 1 (GPT-OSS) failed, trying Tier 2 (Gemini): ${e.message}`);
      }

      // 2. Gemini (Tier 2 / Fallback)
      const model = this.genAI.getGenerativeModel({
        model: this.fallbackModel,
        generationConfig: { responseMimeType: 'application/json', temperature: temperature ?? 0.1 },
      });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nUser Request: ${message}` }] }]
      });
      return JSON.parse(result.response.text());
    } catch (e) {
      this.logger.error(`[PROMPT-SERVICE] All authorized model tiers failed for action plan: ${e.message}`);
      return { status: 'error', reason: e.message };
    }
  }

  /**
   * Generates a final conversational summary that is strictly grounded in the Execution Trace.
   */
  public async generateFinalResponse(
    intent: AiIntent, 
    steps: any[], 
    language: string = 'en', 
    virtualLedger: any = {}, 
    workflowState: any = {}, 
    truthObject: TruthObject,
    role: UserRole = UserRole.COMPANY_STAFF,
    errors: string[] = [],
    immediateResponse?: string
  ): Promise<string> {
    const isTenant = role === UserRole.TENANT;
    
    // Mombasa Pipe Patch v4.1: HARD ISOLATION
    // We physically strip all technical fields before the LLM can even see them.
    const isBlocked = errors.length > 0;
    const blockErrors = errors;
    const publicTruth = this.sanitizeForPublic(truthObject?.data || {});
    const publicContext = this.sanitizeForPublic(truthObject?.context || {});
    const publicSteps = (steps || []).filter(s => s.success).map(s => ({
      tool: s.tool,
      summary: this.sanitizeForPublic(s.result?.summary || s.result?.status || 'Completed')
    }));

    // Aedra v4.2: EMERGENCY SAFETY TEMPLATE
    let emergencyInstructions = '';
    if (intent === AiIntent.EMERGENCY || truthObject.data?.isEmergency) {
      emergencyInstructions = `
      🚨 EMERGENCY SAFETY PROCEDURES (MANDATORY):
      - If the issue involves WATER (leak, pipe burst): Instruct the user to SHUT OFF THE MAIN WATER VALVE immediately.
      - If the issue involves ELECTRICITY (sparks, smoke): Instruct the user to AVOID the area.
      - DO NOT ask for details until safety instructions are provided.
      `;
    } else if (intent === AiIntent.UTILITY_OUTAGE || truthObject.data?.isUtilityOutage) {
      emergencyInstructions = `
      🚰 UTILITY OUTAGE GUIDELINES:
      - Acknowledge the outage (No water/No power).
      - Inform the user that you are checking the building's pump/meter status.
      - Ask if neighbors are also affected.
      - DO NOT give evacuation or main-valve shutoff instructions unless flooding is mentioned.
      `;
    }

      const systemPrompt = `
      You are the DETERMINISTIC RENDERING ENGINE for Aedra.
      Your task is to convert the OPERATIONAL TRUTH into a natural language response.
      
      [ROLE]: ${role}
      [INTENT]: ${intent}
      [LANGUAGE]: ${language}
      [OPERATIONAL_TRUTH]: ${JSON.stringify(publicTruth)}
      [VIRTUAL_LEDGER]: ${JSON.stringify(virtualLedger)}
      [STEPS_PERFORMED]: ${JSON.stringify(publicSteps)}
      [INTEGRITY_ERRORS]: ${JSON.stringify(errors)}
      
      ${isBlocked ? `
      [🚨 STATUS: BLOCKED 🚨]
      The request current state is INCOMPLETE due to these specific blockers:
      ${blockErrors.map((e: string) => `- ${e}`).join('\n')}
      ` : ''}

      ${emergencyInstructions}
      
      RESPONSE STYLE (MANDATORY):
      Your response MUST follow a natural human flow. 
      - DO NOT include any automated greets like "Hello [searchedEntity]".
      - DO NOT repeat the user's name if they are STAFF/LANDLORD.
      - 1. ACKNOWLEDGE: Briefly confirm the request.
      - 2. ACTION TAKEN: State what you found in the specific tool 'RESULTS' (OPERATIONAL_TRUTH).
      - 3. PROACTIVE CLOSURE: Offer a solution or next step (e.g. Audit/Sync/Ticket).
      
      ACTION INTEGRITY:
      - NEVER prioritize personal troubleshooting advice over logging a formal maintenance ticket.
      - If 'STEPS_PERFORMED' show success for log_maintenance_issue, ALWAYS state the ticket has been logged and provide a realistic 4-24 hour timeline for Nairobi vendors.
      - NEVER say "I've fixed", "I've resolved", or "shida imeisha". You only log/escalate.
      - If 'OPERATIONAL_TRUTH' shows 'ENTITY_NOT_FOUND', say "I couldn't locate those details to finalize the update."
      - DO NOT use technical terms like "unverified", "null", or "undefined" in your response.
      - Use natural terms for finance: "madeni" or "hali ya malipo".
      
      OUTCOME-DRIVEN TEMPLATES (v5.5):
      - EMERGENCY (Burst/Flood): [Safety Instructions] + "Sawa, I've escalated this as a critical emergency maintenance issue. Our team is dispatching immediately."
      - MAINTENANCE (Standard/Leak): [ACK] + "I've logged your request for [Issue]. A technician will contact you shortly to schedule the repair."
      - NOISE_COMPLAINT: [ACK] + "I've logged this report discreetly for our management records." + [Action: "I've sent a notification to the occupant of [Unit]."] + [Next Step: "We will monitor the situation."] 🚨 NEVER mention technicians or maintenance.
      - LATE_PAYMENT: [Empathy/Policy ACK] + "I've noted that you plan to pay on [Date]." + [Action Taken: "I checked your current balance."] + [Policy: "Please note that late fees may apply after the 5th."] + [Next Step: "I've updated our records with your promise."]
      - FINANCIAL: [Summary Data Table]. (CRITICAL: If 'reportUrl' exists in OPERATIONAL_TRUTH, you MUST output exactly: "\n\nYou can download the full report here: [reportUrl]") + (If NO 'reportUrl' and ledger is empty: "I've checked our records but couldn't generate a summary.") + [Next Step].
      - ONBOARDING: [Welcome] + [Action: "Tenant profile created for [Unit]."] + [Next Step: "Please review the lease details below."]
      - INCONSISTENCY: [ACK] + [Findings: "I've checked the unit and tenant records. I found that [Conflict Details from OPERATIONAL_TRUTH]."] + [Question: "Could you please confirm which unit should be the active lease for this tenant?"] + [Proactive Action: "I have flagged this record for an administrative audit."]
      - DISPUTE: [ACK] + [Analysis: "I've reviewed your ledger today. I see that the [Amount] charge is for: [STRICT: Use the 'description' field from 'paymentHistory' in OPERATIONAL_TRUTH]."] + [Proactive Action: "I've opened a dispute ticket for this."] + [Next Step: "I'll update you once management reviews the August rental cycle."]
      
      HARD EXECUTION CONTRACTS:
      - FINANCIAL/REPORTING: You MUST output a Markdown table. NO polymorphic paragraphs.
      - MAINTENANCE: You MUST categorize by Priority (LOW/MEDIUM/HIGH/EMERGENCY).
      - AMBIGUITY: If disambiguation candidates exist, you MUST output the Candidates Table.
      
      ANTI-META-TALK (v5.1):
      - DO NOT mention "Operational Truth", "Rendering Engine", or "Prompt Instructions".
      - DO NOT explain why you are responding a certain way.
      - JUST BE THE PROPERTY MANAGER.
      
      PLACEHOLDER ERADICATION:
      - NEVER use placeholders like "$X", "[amount]", or "??". 
      - If data is missing and no fallback exists, state "DATA_UNAVAILABLE" and request the specific field.
      `;
    
    try {
      const response = await this.callModel(systemPrompt, [], this.primaryModel, 0.1);
      return response;
    } catch (e: any) {
      this.logger.warn(`[PromptService] Tier 1 (${this.primaryModel}) Rendering failed: ${e.message}`);
      try {
        const response = await this.callModel(systemPrompt, [], this.fallbackModel, 0.1);
        return response;
      } catch (fallbackError: any) {
        this.logger.error(`[PromptService] Tier 2 (${this.fallbackModel}) Rendering also failed: ${fallbackError.message}`);
        return "Request processed. If you need more details, please ask specific questions.";
      }
    }
  }

  /**
   * Generates a final conversational summary of tool execution results.
   */
  async generateFinalSummary(
    planIntent: string,
    steps: any[],
    language: string,
    ledger: any,
    workflowState: any,
    truth: any,
    role: string,
    state: string = '',
    temperature: number = 0.7,
    originalMessage: string = 'N/A',
    precursorResponse: string = '',
    forceGemini: boolean = false
  ): Promise<string> {
    const prompt = `You are Aedra, a property manager. 
      Role: ${role}
      Intent: ${planIntent}
      Language: ${language}
      
      PREVIOUS ACKNOWLEDGEMENT: "${precursorResponse || 'None'}"
      (If a previous acknowledgement exists, DO NOT repeat it. Start directly with the next step or detailed info).
      
      RESPONSE STYLE (MANDATORY):
      Your response MUST follow a natural human flow. 
      - DO NOT include any automated greets like "Hello [searchedEntity]".
      - DO NOT repeat the user's name if they are STAFF/LANDLORD.
      - 1. ACKNOWLEDGE: Briefly confirm the request.
      - 2. ACTION TAKEN: State what you found in the specific tool 'RESULTS'.
      - 3. PROACTIVE CLOSURE: Offer a solution or next step (e.g. Audit/Sync/Ticket).
      
      ACTION INTEGRITY:
      - NEVER prioritize personal troubleshooting advice over logging a formal maintenance ticket.
      - If 'RESULTS' show success for log_maintenance_issue, ALWAYS state the ticket has been logged and provide a realistic 4-24 hour timeline for Nairobi vendors.
      - NEVER say "I've fixed", "I've resolved", or "shida imeisha". You only log/escalate.
      - If 'RESULTS' show 'ENTITY_NOT_FOUND', say "I couldn't locate those details to finalize the update."
      - DO NOT use technical terms like "unverified", "null", or "undefined" in your response.
      - Use natural terms for finance: "madeni" or "hali ya malipo".
      
      OUTCOME-DRIVEN TEMPLATES:
      - EMERGENCY (Burst/Flood): [Safety Instructions] + "Sawa, I've escalated this as a critical emergency maintenance issue. Our team is dispatching immediately."
      - MAINTENANCE (Standard/Leak): [ACK] + "I've logged your request for [Issue]. A technician will contact you shortly to schedule the repair."
      - NOISE_COMPLAINT: [ACK] + "I've logged this report discreetly for our management records." + [Action: "I've sent a notification to the occupant of [Unit]."] + [Next Step: "We will monitor the situation."] 🚨 NEVER mention technicians or maintenance.
      - LATE_PAYMENT: [Empathy/Policy ACK] + "I've noted that you plan to pay on [Date]." + [Action Taken: "I checked your current balance."] + [Policy: "Please note that late fees may apply after the 5th."] + [Next Step: "I've updated our records with your promise."]
      - FINANCIAL: [Summary Data Table]. (CRITICAL: If 'reportUrl' exists in RESULTS.data, you MUST output exactly: "\n\nYou can download the full report here: [reportUrl]") + (If NO 'reportUrl' and ledger is empty: "I've checked our records but couldn't generate a summary.") + [Next Step].
      - ONBOARDING: [Welcome] + [Action: "Tenant profile created for [Unit]."] + [Next Step: "Please review the lease details below."]
      - INCONSISTENCY: [ACK] + [Findings: "I've checked the unit and tenant records. I found that [Conflict Details from RESULTS]."] + [Question: "Could you please confirm which unit should be the active lease for this tenant?"] + [Proactive Action: "I have flagged this record for an administrative audit."]
      - DISPUTE: [ACK] + [Analysis: "I've reviewed your ledger today. I see that the [Amount] charge is for: [STRICT: Use the 'description' field from 'paymentHistory' in RESULTS]."] + [Proactive Action: "I've opened a dispute ticket for this."] + [Next Step: "I'll update you once management reviews the August rental cycle."]
      
      STEPS: ${JSON.stringify(steps)}
      RESULTS: ${JSON.stringify(truth)}
      ACTIVE CONTEXT: ${state}
      USER MESSAGE: ${originalMessage || 'N/A'}
      LANGUAGE: ${language}
      
      HARD EXECUTION CONTRACTS:
      - FINANCIAL/REPORTING: You MUST output a Markdown table. NO polymorphic paragraphs.
      - MAINTENANCE: You MUST categorize by Priority (LOW/MEDIUM/HIGH/EMERGENCY).
      - AMBIGUITY: If disambiguation candidates exist, you MUST output the Candidates Table.
      
      ANTI-META-TALK (v5.1):
      - DO NOT mention "Operational Truth", "Rendering Engine", or "Prompt Instructions".
      - DO NOT explain why you are responding a certain way.
      - JUST BE THE PROPERTY MANAGER.
      
      PLACEHOLDER ERADICATION:
      - NEVER use placeholders like "$X", "[amount]", or "??". 
      - If data is missing and no fallback exists, state "DATA_UNAVAILABLE" and request the specific field.
      
      AUTHORITY BOUNDARY (Strict):
      - If RESULTS show tool failure but manual_aggregation exists, you MUST generate an **OPERATIONAL DASHBOARD** showing total revenue and count.
      - If [BUFFERED_TRANSACTION] exists, you MUST acknowledge the specific amount/date mentioned.
      - If RESULTS show a PARTIAL match, you MUST disclose the assumption.
      - If RESULTS show ambiguous candidates, you MUST use the Candidates Table template.
    `;

    try {
      return await this.callModel(prompt, [], forceGemini ? 'gemini-2.0-flash' : this.primaryModel, temperature);
    } catch (e: any) {
      this.logger.error(`[PromptService] All authorized summary tiers failed: ${e.message}`);
      return "Action completed successfully, but I'm having trouble displaying the summary.";
    }
  }

  /**
   * Deterministic Acknowledgement: Generates a natural language response
   * for a specific workflow state, ensuring zero tool calls.
   */
  async generateAcknowledgement(
    message: string,
    stateDescription: string,
    context: any,
    history: any[]
  ): Promise<string> {
    const systemPrompt = `
You are Aedra, a property management AI. 
Current Workflow Step: ${stateDescription}

CRITICAL RULES:
1. DO NOT call any tools.
2. DO NOT promise actions outside of the current step.
3. Be professional, empathetic, and concise.

Context: ${JSON.stringify(context)}
    `;

    return this.callModel(systemPrompt + `\nUser Request: ${message}`, history, 'gemini-2.0-flash', 0.1);
  }

  private async callModel(prompt: string, history: any[], modelName: string, temperature: number): Promise<string> {
    const isGemini = modelName.includes('gemini');
    
    if (isGemini) {
      const model = this.genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { temperature },
      });
      
      const contents = history.length > 0 ? [
        ...history.map(h => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] })),
        { role: 'user', parts: [{ text: prompt }] }
      ] : [{ role: 'user', parts: [{ text: prompt }] }];

      const result = await model.generateContent({ contents });
      return result.response.text();
    } else {
      const completion = await this.groq.chat.completions.create({
        model: modelName,
        messages: [
          ...history,
          { role: 'user', content: prompt },
        ],
        temperature,
      });
      return completion.choices[0]?.message?.content || '';
    }
  }

  private sanitizeForPublic(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.sanitizeForPublic(item));

    const forbidden = [
      'sessionId', 'userId', 'companyId', 'intent', 'operationalAction', 
      'computedAt', 'traceId', 'executionId', 'lockedState', 
      'requiresContext', 'requiredTools', 'forbiddenActions'
    ];

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      // 0. EXPLICIT PASS-THROUGH: Critical for reporting and user-facing links
      if (['url', 'reporturl', 'link', 'download'].includes(lowerKey)) {
        sanitized[key] = value;
        continue;
      }

      // 1. Strip strictly technical session/state fields
      if (forbidden.some(f => lowerKey === f.toLowerCase())) continue;
      
      // 2. MASK UUIDs instead of stripping the entire key-value pair if it's a business ID (e.g. tenantId)
      const isUuid = typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
      if (isUuid) {
        if (['tenantid', 'unitid', 'propertyid', 'id'].includes(lowerKey)) {
          sanitized[key] = '[RESOLVED_DATABASE_ID]';
          continue;
        }
        continue; // Strip other UUIDs
      }

      sanitized[key] = this.sanitizeForPublic(value);
    }
    return sanitized;
  }
}
