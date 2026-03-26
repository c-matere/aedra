import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../auth/roles.enum';
import { withRetry } from '../common/utils/retry';

@Injectable()
export class AiPromptService {
  private readonly logger = new Logger(AiPromptService.name);
  private readonly primaryModel = 'openai/gpt-oss-20b';
  private readonly fallbackModel = 'gemini-2.0-flash';

  constructor(
    private readonly prisma: PrismaService,
    private readonly genAI: GoogleGenerativeAI,
    private readonly groq: Groq,
  ) {}

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
   * Generates a multi-step action plan using the planner model.
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
   * Generates a final conversational summary of tool execution results.
   */
  /**
   * Generates a final conversational summary of tool execution results using the Rendering Lock.
   */
  public async generateFinalResponse(intent: string, results: any[], language: string = 'en', virtualLedger?: any, activeWorkflow?: any, truthObject?: any): Promise<string> {
    // 1. Detect dynamic intent from results (Kernel override)
    const resultTypes = results.map(r => r.result?.type || '').join(', ');
    const isEmergency = resultTypes.includes('EMERGENCY') || intent.includes('EMERGENCY');
    const isMaintenance = (resultTypes.includes('MAINTENANCE') || intent.includes('MAINTENANCE')) && !isEmergency;
    const isFinancial = ['FINANCIAL_QUERY', 'LATE_PAYMENT'].includes(intent) && !isEmergency && !isMaintenance;
    const isReporting = intent === 'FINANCIAL_REPORTING' && !isEmergency && !isMaintenance;
    const isOnboarding = (resultTypes.includes('ONBOARDING') || intent.includes('ONBOARDING')) && !isEmergency && !isMaintenance;
    
    const candidateResult = results.find(r => r.tool === 'disambiguation_candidates')?.result;
    const truthData = truthObject?.data || {};

    let schemeInstructions = '';
    
    if (isEmergency) {
      schemeInstructions = `
        MANDATORY EMERGENCY LOCK:
        | Escalation Level | Action Taken | Technical Dispatch |
        | :--- | :--- | :--- |
        | ${truthData.priority || 'CRITICAL'} | Escalated to Vendor/Manager | IMMEDIATE |
        
        INSTRUCTIONS: You MUST provide immediate safety instructions (e.g. "Close the main valve").
      `;
    } else if (isMaintenance) {
      schemeInstructions = `
        MANDATORY MAINTENANCE LOG:
        | Issue Type | Priority | Status |
        | :--- | :--- | :--- |
        | ${intent} | ${truthData.priority || 'MEDIUM'} | RECORDED |
      `;
    } else if (isFinancial) {
      schemeInstructions = `
        MANDATORY FINANCIAL SCHEMA:
        | Description | Value | Status |
        | :--- | :--- | :--- |
        | Target Property | ${truthData.inputTruth?.propertyName || 'N/A'} | ${truthData.inputTruth?.propertyName ? '⏳ IDENTIFIED' : '❌ MISSING'} |
        | Total Arrears | KSh ${truthData.arrears?.toLocaleString() || 0} | ${truthData.portfolioArrears ? '🧮 COMPUTED' : '✅ VERIFIED'} |
        | Payment Received | KSh ${truthData.balance || 0} | ✅ VERIFIED |
        | **Remaining Balance** | **KSh ${truthData.balance?.toLocaleString() || 0}** | ✅ VERIFIED |
      `;
    } else if (isReporting) {
      schemeInstructions = `
        MANDATORY PORTFOLIO REPORT:
        | KPI | Value | Status |
        | :--- | :--- | :--- |
        | Report For | ${truthData.inputTruth?.propertyName || 'Portfolio-wide'} | ${truthData.inputTruth?.propertyName ? '⏳ IDENTIFIED' : '✅ GLOBAL'} |
        | Total Revenue | KSh ${truthData.totalRevenue?.toLocaleString() || 0} | 🧮 COMPUTED |
        | Collection Rate | ${truthData.collectionRate || '0'}% | 🧮 COMPUTED |
        | Portfolio Arrears | KSh ${truthData.portfolioArrears?.toLocaleString() || 0} | 🧮 COMPUTED |
        
        INSTRUCTIONS: Present this as a formal Monthly Summary Report for the landlord.
      `;
    } else if (isOnboarding) {
      const tenant = truthData.tenantIdentity || { status: 'MISSING' };
      const nameStatus = tenant.status === 'VERIFIED' ? '✅ VERIFIED' : (tenant.name ? '⏳ PENDING (Claimed)' : '❌ MISSING');
      const unitStatus = tenant.unit ? '✅ IDENTIFIED' : '❌ MISSING';
      
      schemeInstructions = `
        MANDATORY ONBOARDING STATUS:
        | Component | Value | Status |
        | :--- | :--- | :--- |
        | Tenant | ${tenant.name || 'PENDING'} | ${nameStatus} |
        | Unit | ${tenant.unit || 'PENDING'} | ${unitStatus} |
        | **Registration** | **Initiated** | **PROGRESSIVE** |
      `;
    }

    if (candidateResult && Array.isArray(candidateResult)) {
      schemeInstructions += `
        MANDATORY CANDIDATE BOARD:
        | Unit | Name | Status |
        | :--- | :--- | :--- |
        ${candidateResult.map(c => `| ${c.unit || 'N/A'} | ${c.name} | ${c.status || 'Active'} |`).join('\n')}
      `;
    }

    const systemPrompt = `
      RENDER the response using this PROGRESSIVE TRUTH.
      
      TRUTH_OBJECT: ${JSON.stringify(truthObject || {})}
      RESULTS: ${JSON.stringify(results)}
      
      ACT ON WHAT IS KNOWN. If the user provided a name, use it. If the DB verified it, label it verified.
      
      RENDERING LOCK:
      1. Provide a brief, natural language acknowledgment FIRST.
      2. If data is missing (Status: MISSING), do NOT stop. Show what IS known and ask for the rest.
      3. Use the MANDATORY SCHEMA below.
      4. Use these Status Icons: ✅ (Verified), 🧮 (Computed), ⏳ (Pending/User Input).
      
      ${schemeInstructions}
    `;

    try {
      // 1. Groq - GPT OSS 20b (Primary)
      try {
        const completion = await this.groq.chat.completions.create({
          model: this.primaryModel,
          messages: [
            { role: 'system', content: 'You are a deterministic rendering engine. You convert verified truth into Markdown tables. NEVER invent data.' },
            { role: 'user', content: systemPrompt },
          ],
          temperature: 0,
          // @ts-ignore - Support user-suggested reasoning_effort
          reasoning_effort: 'medium',
        });
        return completion.choices[0]?.message?.content || 'RENDER_FAILURE';
      } catch (e) {
        this.logger.warn(`[PROMPT-SERVICE] RENDERER Tier 1 (GPT-OSS) failed: ${e.message}`);
      }

      // 2. Gemini (Fallback)
      const model = this.genAI.getGenerativeModel({
        model: this.fallbackModel,
        generationConfig: { temperature: 0 },
      });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: systemPrompt }] }]
      });
      return result.response.text();
    } catch (e) {
      this.logger.error(`[PROMPT-SERVICE] All authorized RENDERER tiers failed: ${e.message}`);
      return "Critical rendering failure.";
    }
  }

  /**
   * Generates a final conversational summary of tool execution results.
   */
  async generateFinalSummary(
    plan: any,
    results: any[],
    language: string,
    role: string,
    state: string = '',
    temperature: number = 0.7,
    originalMessage: string = 'N/A',
  ): Promise<string> {
    const prompt = `You are Aedra, a property management AI. 
      Role: ${role}
      Intent: ${plan.intent}
      
      RESPONSE STYLE (MANDATORY):
      Your response MUST follow a natural human flow without using technical labels or brackets.
      1. ACKNOWLEDGE: Start by confirming you understood the request (e.g., "I've received your request for the Palm Grove report").
      2. ACTION TAKEN: State exactly what you found or attempted (e.g., "I've reviewed the collection rates for your portfolio").
      3. NEXT STEP: Provide the specific data or ask for the next requirement (e.g., "The current collection rate is 94%. Would you like a unit-by-unit breakdown?").
      
      ACTION INTEGRITY:
      - NEVER say "I've logged/recorded" if the 'RESULTS' above do not show a successful status for that exact action.
      - If 'RESULTS' show 'ENTITY_NOT_FOUND', say "I couldn't locate those details to finalize the update."
      
      OUTCOME-DRIVEN TEMPLATES:
      - EMERGENCY (Burst/Flood): [Safety Instructions] + "Sawa, I've escalated this as a critical emergency maintenance issue. Our team is dispatching immediately."
      - MAINTENANCE (Standard/Leak): [ACK] + "I've logged your request for [Issue]. A technician will contact you shortly to schedule the repair."
      - NOISE_COMPLAINT: [ACK] + "I've logged this report discreetly for our management records." + [Action: "I've sent a notification to the occupant of [Unit]."] + [Next Step: "We will monitor the situation."] 🚨 NEVER mention technicians or maintenance.
      - LATE_PAYMENT: [Empathy/Policy ACK] + "I've noted that you plan to pay on [Date]." + [Action Taken: "I checked your current balance."] + [Policy: "Please note that late fees may apply after the 5th."] + [Next Step: "I've updated our records with your promise."]
      - FINANCIAL: [Direct Data / Manual Summary] + [Context: "This reflects all payments compiled from raw base records."] + [Next Step].
      - ONBOARDING: [Welcome] + [Action: "Tenant profile created for [Unit]."] + [Next Step: "Please review the lease details below."]
      
      PLAN: ${JSON.stringify(plan)}
      RESULTS: ${JSON.stringify(results)}
      ACTIVE CONTEXT: ${state}
      USER MESSAGE: ${originalMessage || 'N/A'}
      LANGUAGE: ${language}
      
      HARD EXECUTION CONTRACTS:
      - FINANCIAL/REPORTING: You MUST output a Markdown table. NO polymorphic paragraphs.
      - MAINTENANCE: You MUST categorize by Priority (LOW/MEDIUM/HIGH/EMERGENCY).
      - AMBIGUITY: If disambiguation candidates exist, you MUST output the Candidates Table.
      
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
      // 1. Groq - GPT OSS 20b (Primary)
      try {
        const completion = await this.groq.chat.completions.create({
          model: this.primaryModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: temperature,
        });
        const text = completion.choices[0]?.message?.content;
        if (text) return text;
      } catch (e) {
        this.logger.warn(`[PROMPT-SERVICE] Tier 1 (GPT-OSS) FinalSummary failed: ${e.message}`);
      }

      // 2. Gemini (Tier 2 / Fallback)
      const model = this.genAI.getGenerativeModel({
        model: this.fallbackModel,
        generationConfig: { temperature: temperature },
      });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });
      return result.response.text();
    } catch (e) {
      this.logger.error(`[PROMPT-SERVICE] All authorized summary tiers failed: ${e.message}`);
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

    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
    const completion = await withRetry(() =>
      model.generateContent({
        contents: [
            ...history,
            { role: 'user', parts: [{ text: `${systemPrompt}\nUser Request: ${message}` }] }
        ]
      })
    );

    return completion.response.text() || "I've received your request and I'm processing it according to our management policy.";
  }
}
