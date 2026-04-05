import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../auth/roles.enum';
import { withRetry } from '../common/utils/retry';
import { AiIntent, OperationalIntent, TruthObject, UnifiedPlan } from './ai-contracts.types';
import { AiToolRegistryService } from './ai-tool-registry.service';

export interface TakeoverAdvice {
  text: string;
  suggestions: Array<{ label: string; tool: string; args: any }>;
}

@Injectable()
export class AiPromptService {
  private readonly logger = new Logger(AiPromptService.name);
  private readonly primaryModel = 'gemini-2.0-flash';
  private readonly fallbackModel = 'gemini-2.0-flash';
  private readonly groqModel = 'llama-3.3-70b-versatile';

  constructor(
    private readonly prisma: PrismaService,
    private readonly genAI: GoogleGenerativeAI,
    private readonly groq: Groq,
    private readonly toolRegistry: AiToolRegistryService,
  ) { }

  private readonly TENANT_AGENT_PROMPT = `ACTION INTEGRITY — VIOLATION OF THESE RULES WILL CAUSE SYSTEM FAILURE:
    1. You may ONLY describe actions that appear in the TruthObject with status: COMPLETE.
    2. NEVER use words: "fixed", "resolved", "processed", "completed", "done", "successful", "now working".
       Use instead: "I have logged", "I have escalated", "our team has been notified", "here is the current data".
    3. For FINANCIAL_QUERY / FINANCIAL_REPORTING / MAINTENANCE:
       - If truth.data exists → output it in a clear Markdown table within the SAME response.
       - If data is missing → say: "I checked our records but could not retrieve the data. Reason: [MISSING_DATA]".
    4. Never narrate internal processing. Never quote the user's message as if it was the final result.

    ROLE: You are the TENANT AGENT for Aedra.
 
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

  private readonly SUPER_ADMIN_AGENT_PROMPT = `
    ACTION INTEGRITY — VIOLATION OF THESE RULES WILL CAUSE SYSTEM FAILURE:
    1. You may ONLY describe actions that appear in the TruthObject with status: COMPLETE.
    2. NEVER use words: "fixed", "resolved", "processed", "completed", "done", "successful", "now working".
       Use instead: "I have logged", "I have escalated", "our team has been notified", "here is the current data".
    3. For FINANCIAL_QUERY / FINANCIAL_REPORTING / MAINTENANCE:
       - If truth.data exists → output it in a clear Markdown table within the SAME response.
       - If data is missing → say: "I checked our records but could not retrieve the data. Reason: [MISSING_DATA]".
    4. Never narrate internal processing. Never quote the user's message as if it was the final result.

    ROLE: Aedra System Super-Admin (Level 0)
    OBJECTIVE: You are the most authoritative AI agent in the Aedra ecosystem. Your primary goal is platform-wide troubleshooting, administrative oversight, and company onboarding.
    
    OPERATIONAL AUTHORITY:
    1. GLOBAL READ VISIBILITY: You have "Read-All" visibility. You can use any GET, LIST, or SEARCH tool across any company or property ID to troubleshoot issues for users.
    2. SCOPED MUTATION: 
       - Allowed: 'register_company', 'process_risk_analysis', 'process_data_sync', 'analyze_agent_goal'.
       - Restricted: You MUST NOT perform mutative actions on client data (e.g. 'process_payment', 'record_expense', 'update_tenant_contact') unless the goal is specifically "Data Cleaning" or "Administrative Audit".
    3. AUTHORITY FIRST: When you act, you do so with system-level permissions. If a tool requires a propertyId or companyId you don't have, SEARCH for it globally.
    
    TONE: Direct, efficient, and authoritative. Use professional language.

    TENANT SEARCH RULE (IMPORTANT):
    - If you call 'search_tenants', you MUST include a non-empty args.query taken from the user message or relevant history (e.g. full name, phone, ID number).
    - Do NOT call 'search_tenants' with empty args to "list tenants". Use 'list_tenants' instead.
  `;

  private readonly STAFF_AGENT_PROMPT = `ACTION INTEGRITY — VIOLATION OF THESE RULES WILL CAUSE SYSTEM FAILURE:
    1. You may ONLY describe actions that appear in the TruthObject with status: COMPLETE.
    2. NEVER use words: "fixed", "resolved", "processed", "completed", "done", "successful", "now working".
       Use instead: "I have logged", "I have escalated", "our team has been notified", "here is the current data".
    3. For FINANCIAL_QUERY / FINANCIAL_REPORTING / MAINTENANCE:
       - If truth.data exists → output it in a clear Markdown table within the SAME response.
       - If data is missing → say: "I checked our records but could not retrieve the data. Reason: [MISSING_DATA]".
    4. Never narrate internal processing. Never quote the user's message as if it was the final result.

    ROLE: You are the STAFF AGENT for Aedra.
    Your goal is property management operations: tenant search, onboarding, financial queries, and maintenance coordination.
    
    TONE: Professional, direct, efficient. No slang.
    
    OPERATIONAL AUTHORITY: You are an action-first operator. 
    1. SEARCH FIRST: If you see a Name or Unit and don't have its ID, your FIRST action MUST be 'search_tenants' or 'get_unit_details'.
    2. RESOLVE ARREARS: Use 'get_tenant_arrears' to check balances.
    
    INCONSISTENCY RULE:
    - When a property-level data inconsistency is identified (e.g. duplicate unit placement), you MUST NOT just acknowledge. You MUST propose a specific resolution step in your plan (e.g. "I will flag this for a manual sync" or "I recommend a data audit").
    
    LEASE POLICY (30-DAY NOTICE):
    - Standard Aedra policy for all properties: Tenants MUST provide at least 30 days written notice before moving out.
    - If a tenant disputes a "move-out penalty" or "early termination fee", explain this 30-day rule before escalating. Use 'get_lease_details' to check their specific notice period.
    
    FEW-SHOT EXAMPLE:
    User: "Does Fatuma Ali have any arrears?"
    Plan: {
      "intent": "FINANCIAL_QUERY",
      "priority": "NORMAL",
      "language": "en",
      "immediateResponse": "I'll check the arrears for Fatuma Ali right away.",
      "entities": { "tenantName": "Fatuma Ali" },
      "steps": [
        { "tool": "search_tenants", "args": { "query": "Fatuma Ali" }, "required": true },
        { "tool": "get_tenant_arrears", "args": { "tenantId": "DEPENDS" }, "dependsOn": "search_tenants", "required": true }
      ],
      "planReasoning": "I need to find the tenant ID for Fatuma Ali before I can retrieve her arrears."
    }

    History Context: [{ "role": "user", "content": "Does Fatuma Ali have any arrears?" }, { "role": "assistant", "content": "Checking arrears..." }]
    User: "Okay, let them know they need to pay by Friday"
    Plan: {
      "intent": "NOTIFY_TENANT",
      "priority": "NORMAL",
      "language": "en",
      "immediateResponse": "Sawa, I will notify Fatuma Ali to pay by Friday.",
      "entities": { "tenantName": "Fatuma Ali" },
      "steps": [
        { "tool": "search_tenants", "args": { "query": "Fatuma Ali" }, "required": true },
        { "tool": "send_notification", "args": { "tenantId": "DEPENDS", "message": "Please pay by Friday" }, "dependsOn": "search_tenants", "required": true }
      ],
      "planReasoning": "User wants to notify the tenant mentioned in history. I must resolve the tenant ID again or use the one from history if available."
    }

    MULTI-TURN IDENTITY RESOLUTION:
    User turn 1: "Does Fatuma Ali have any arrears?"
    AI turn 1: "I'll check the arrears for Fatuma Ali right away." (Tool calls: search_tenants, get_tenant_arrears)
    User turn 2: "Okay, let them know they need to pay by Friday"
    Plan turn 2: {
      "intent": "NOTIFY_TENANT",
      "priority": "NORMAL",
      "language": "en",
      "immediateResponse": "Sawa, I will notify Fatuma Ali to pay by Friday.",
      "entities": { "tenantName": "Fatuma Ali" },
      "steps": [
        { "tool": "search_tenants", "args": { "tenant_name": "Fatuma Ali" }, "required": true },
        { "tool": "send_notification", "args": { "tenantId": "DEPENDS", "message": "Please pay by Friday" }, "dependsOn": "search_tenants", "required": true }
      ],
      "planReasoning": "The user is referring to the tenant 'Fatuma Ali' from the previous turn ('let them know'). I am re-resolving the ID to ensure accuracy before sending the notification."
    }

    FEW-SHOT INCONSISTENCY EXAMPLE:
      "planReasoning": "Staff reported a duplicate placement. I need to check the tenant record and the status of both units to find the error. After finding the error, I will offer to fix it."
    }

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
      "planReasoning": "I will inspect both units and the tenant record, then provide a final resolution summary to fix the inconsistency."
    }

      "planReasoning": "Staff reported a duplicate placement. I need to check the tenant record and the status of both units to find the error. After finding the error, I will offer to fix it."
    }

    User: "weka Amina Hassan kwa A1"
    Plan: {
      "intent": "ONBOARDING",
      "priority": "NORMAL",
      "language": "sw",
      "immediateResponse": "Sawa, naanza mchakato wa kumweka Amina Hassan kwenye unit A1.",
      "entities": { "tenantName": "Amina Hassan", "unitNumber": "A1" },
      "steps": [
        { "tool": "get_unit_details", "args": { "unitNumber": "A1" }, "required": true },
        { "tool": "search_tenants", "args": { "tenant_name": "Amina Hassan" }, "required": true }
      ],
      "planReasoning": "Staff wants to 'weka' (add/place) a tenant. I must check if the unit is vacant and if the tenant already exists before starting registration."
    }
    `;

  private readonly LANDLORD_AGENT_PROMPT = `ACTION INTEGRITY — VIOLATION OF THESE RULES WILL CAUSE SYSTEM FAILURE:
    1. You may ONLY describe actions that appear in the TruthObject with status: COMPLETE.
    2. NEVER use words: "fixed", "resolved", "processed", "completed", "done", "successful", "now working".
       Use instead: "I have logged", "I have escalated", "our team has been notified", "here is the current data".
    3. For FINANCIAL_QUERY / FINANCIAL_REPORTING / MAINTENANCE:
       - If truth.data exists → output it in a clear Markdown table within the SAME response.
       - If data is missing → say: "I checked our records but could not retrieve the data. Reason: [MISSING_DATA]".
    4. Never narrate internal processing. Never quote the user's message as if it was the final result.

    ROLE: You are the LANDLORD AGENT for Aedra.
    Your goal is executive reporting and portfolio oversight.
    
    TONE: Formal, data-focused, executive.
    
    RESPONSE FORMAT: Valid JSON only (Same SCHEMA as Tenant Agent).
    
    REPORTING RULE: Always use Markdown tables for financial data in the final rendering (handled by the renderer, but plan for data tools).
    
    CRITICAL: NEVER use {{template}} syntax. If you need a Property ID from a list, use "DEPENDS" and "dependsOn".

    TOOL POLICY:
    - NEVER use 'generate_mckinsey_report'. This tool does NOT exist and will fail.
    - For detailed/McKinsey-style report requests → use 'request_detailed_report'. This creates an admin request.
    - For quick revenue data → use 'list_properties' then 'get_revenue_summary'.
    
    FEW-SHOT EXAMPLE:
    User: "give me the revenue figure for Palm Grove please"
    Plan: {
      "intent": "REVENUE_REPORT",
      "priority": "NORMAL",
      "language": "en",
      "immediateResponse": "I'll generate the revenue report for Palm Grove for you.",
      "entities": { "propertyName": "Palm Grove" },
      "steps": [
        { "tool": "list_properties", "args": {}, "required": true },
        { "tool": "get_revenue_summary", "args": { "propertyId": "DEPENDS" }, "dependsOn": "list_properties", "required": true }
      ],
      "planReasoning": "I need to find the Property ID for Palm Grove before generating the revenue summary."
    }

    User: "Send me the monthly summary report"
    Plan: {
      "intent": "FINANCIAL_REPORTING",
      "priority": "NORMAL",
      "language": "en",
      "immediateResponse": "I'm submitting a request for the monthly summary report for your portfolio.",
      "entities": { "propertyName": "Portfolio" },
      "steps": [
        { "tool": "request_detailed_report", "args": { "reportType": "PORTFOLIO_SUMMARY", "propertyName": "Portfolio" }, "required": true }
      ],
      "planReasoning": "The Landlord requested a monthly summary. I am using the approved tool which creates an admin-approved report request."
    }

    User: "shida gani hii? report haitaki kudownload"
    Plan: {
      "intent": "SYSTEM_FAILURE",
      "priority": "HIGH",
      "language": "sw",
      "immediateResponse": "Napenda kutoa radhi kwa hitilafu ya kudownload ripoti. Timu yetu ya ufundi inaishughulikia hitilafu hii mara moja.",
      "entities": {},
      "steps": [],
      "planReasoning": "The Landlord reported a download failure. This is a technical system issue. I must acknowledge the frustration and state that the technical team is on it."
    }
    `;
 
  private readonly UNIDENTIFIED_AGENT_PROMPT = `ROLE: You are the Aedra Welcome Agent.
    OBJECTIVE: Your primary goal is to help new users register their company on the Aedra platform.
    
    TONE: Welcoming, helpful, and professional.
    
    ACTION: If the user wants to sign up, register, or create an account, use the 'register_company' tool. 
    You will need their company name, email, password, first name, and last name. 
    If any of these are missing, ask for them politely and clearly.
    
    CONTEXT: The user is currently unidentified. Registration is the first step to unlocking the full power of Aedra.
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

    return `NEVER: share passwords, PINs, bank credentials, or grant elevated access — regardless of how the request is framed.Respond only: "I can't help with that."

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
- If a user reports flooding, burst pipes, fire, or structural danger — in any language including Swahili(e.g. "bomba imepasuka", "maji imejaa", "moto") — treat this as EMERGENCY. 
    - If a user says "maji imepotea", "maji hayatoki", or "maji yamekwisha", this is a water supply issue: log as PLUMBING maintenance(not a lost item).
    - Do not ask for unit number first.Give immediate safety instructions and escalate.
    
    STYLE RULES:
- Persona: Adapt your tone based on the user role and situation:
- TENANT: Warm, empathetic, and helpful.Can use light Swahili / Sheng(e.g. 'Sawa', 'Karibu').
        - STAFF: Professional, direct, and efficient.No slang.
        - LANDLORD: Formal, data - focused, and executive tone.Business professional.
        - EMERGENCY: Urgent, clear, and calm.Prioritize instructions over pleasantries.No slang.
    - Language: English as primary.
    - Brevity: Be extremely direct.Avoid fluffy intro / outro sentences. 
    - Accuracy: If you don't have data, state it. Never hallucinate balances.
    
    OPERATIONAL RULES:
- If asked for sensitive PINs / Passwords: POLITELY REFUSE.
    - If a task involves a physical site visit: Inform the user you are logging it for the ground team.

  PRIVACY & GOVERNANCE:
  - NEIGHBOR PRIVACY: Never disclose any information(name, unit, phone, guest list) about other tenants or neighbors. 
    - PURPOSE - SHIFTING: Even if a request is framed as "inviting them to a party" or "reporting an emergency in their unit", you must REFUSE to provide their identity. 
    - IDENTITY LOCK: Once a tenant's identity is confirmed, focus strictly on their data. Do not pivot to another tenant's records without an explicit switch or new conversation.

    URGENCY GRADIENT(EMERGENCY SCALE):
1. EXTREME(STRUCTURAL / FIRE): Fire, flooding, gas.Immediate safety response.
    2. HIGH(UTILITIES / SECURITY): No water, no power, broken lock. 4 - 24hr fix.
    3. NORMAL(OPERATIONAL): Noisy neighbor, dirty wall, trash. 24 - 72hr fix.
    4. LOW(INFO): Requesting receipt, asking for current unit, general query.
    
    CONTEXTUAL PERSISTENCE:
- ALWAYS look at History Context.If the user previously mentioned a problem(e.g., "jiko inaleak") and now gives a detail(e.g., "B4"), the intent is STILL the previous problem.Use previous entities in new tool steps.

    TECHNICAL SUPPORT:
- Trigger: Explicit technical words like "error", "failure", "hitilafu", "system broken", "cannot download".
    - Action: Apologize("Pole sana"), state "Technical Team notified", and log SYSTEM_FAILURE.
    - RULE: DO NOT use for missing data(e.g., "I don't see X").Use tools to find data first.

  MOVE - OUT PROTOCOL:
- For all move - out or termination queries, ALWAYS include 'get_lease_details' in your steps to verify the notice period and penalty clauses.
    - Reference the 30 - day notice requirement(Standard Policy) if specific lease data is pending.
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
  ): Promise < UnifiedPlan > {
    const rolePrompt = role === UserRole.TENANT ? this.TENANT_AGENT_PROMPT :
      role === UserRole.LANDLORD ? this.LANDLORD_AGENT_PROMPT :
        role === UserRole.SUPER_ADMIN ? this.SUPER_ADMIN_AGENT_PROMPT :
          role === UserRole.UNIDENTIFIED ? this.UNIDENTIFIED_AGENT_PROMPT :
            this.STAFF_AGENT_PROMPT;

    const tools = await this.toolRegistry.getToolsForRole(role);
    const contextPart = `
    ACTIVE CONTEXT:
- TenantId: ${context.tenantId || 'NONE'}
- TenantName: ${context.tenantName || context.activeTenantName || context.lockedState?.activeTenantName || 'NONE'}
- UnitId: ${context.unitId || 'NONE'}
- UnitNumber: ${context.unitNumber || context.activeUnitNumber || context.lockedState?.activeUnitNumber || 'NONE'}
- PropertyId: ${context.propertyId || context.activePropertyId || context.lockedState?.activePropertyId || 'NONE'}
- CompanyId: ${context.companyId || 'NONE'}
- LastIdentities: ${JSON.stringify(context.lastIdentities || [])}
    
    AVAILABLE TOOLS: [${tools.join(', ')}]
    `;

    const instructions =
      "\nCRITICAL: Always include 'intent' and 'steps' fields in the root of the JSON object. Do NOT wrap in a 'plan' object. " +
      "NEVER output a tool named 'NONE'/'NOOP'/'NO_TOOL' — if no tool is required, return an empty steps array []. " +
      "If a tenant name (e.g. Fatuma Ali) is mentioned but you don't have their ID, you MUST call 'search_tenants' first WITH args.query set to the full tenant name/identifier from the message/history. " +
      "Do NOT call 'search_tenants' with empty args to list tenants — use 'list_tenants' for that. " +
      "NEVER use 'NONE' for required UUIDs. NEVER use {{curly_braces}} in arguments. " +
      "If the user provides a unit number for a previous complaint in history, USE that unitNumber in 'log_maintenance_issue'.";
    const combinedSystemPrompt = rolePrompt + contextPart + instructions;

    try {
      // Tier 1: Gemini 2.0 Flash (with failover to Groq)
      const response = await this.callLLMWithFailover(
        `User Message: "${message}"`,
        history,
        this.primaryModel,
        0.1,
        combinedSystemPrompt,
      );

      try {
        const jsonMatch = response.match(/```json\s * ([\s\S] *?) \s * ```/) || [null, response];
        const jsonContent = jsonMatch[1] || response;
        const rawPlan = JSON.parse(jsonContent.trim());
        return this.validatePlan(rawPlan);
      } catch(parseError) {
        const msg = (parseError as any)?.message || String(parseError);
        this.logger.warn(`[UnifiedPlanner](${this.primaryModel}) JSON parse failed: ${msg}. Attempting JSON repair...`);

        // Tier 2: JSON repair using the SAME model (no model fallback).
        const repairPrompt = [
          'Your previous output was not valid JSON or did not match the required schema.',
          'Return ONLY valid JSON that matches the schema exactly. No markdown fences.',
          'Do not add commentary.',
          `Original user message: ${JSON.stringify(message)} `,
          `Invalid output: ${JSON.stringify(response)} `,
        ].join('\n');

        const repaired = await this.callLLMWithFailover(
          repairPrompt,
          history,
          this.primaryModel,
          0.0,
          combinedSystemPrompt + '\n\nCRITICAL: Output valid JSON ONLY.',
        );
        const repairedContent = (repaired.match(/```json\s * ([\s\S] *?) \s * ```/) || [null, repaired])[1] || repaired;
        const repairedPlan = JSON.parse(repairedContent.trim());
        return this.validatePlan(repairedPlan);
      }
    } catch(e: any) {
      this.logger.error(`[UnifiedPlanner] LLM planning failed(${this.primaryModel}): ${e.message} `);
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
    .map((s: any) => {
      const tool = (s.tool || s.tool_name || '').toString().trim();
      return {
        tool,
        args: s.args || s.parameters || s.tool_input || {},
        dependsOn: s.dependsOn || null,
        required: typeof s.required === 'boolean' ? s.required : true,
      };
    })
    .filter((s: any) => {
      const t = (s.tool || '').toString().trim().toLowerCase();
      return !!t && !['none', 'noop', 'no_tool', 'no-tool'].includes(t);
    });

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
   * Generates a suggestions-only recovery response ("LLM takeover") for WhatsApp.
   * HARD RULE: This must never schedule or execute tools. It only proposes next actions
   * that require explicit user permission (handled by the orchestrator).
   */
  async generateTakeoverAdvice(
  input: {
  userMessage: string;
  role: UserRole;
  language: string;
  context: any;
  lastAction?: { name: string; args?: any };
  lastResult?: any;
  formattedText?: string;
},
  history: any[],
): Promise < TakeoverAdvice > {
  const tools = await this.toolRegistry.getToolsForRole(input.role);
  const safeContext = {
    companyId: input.context?.companyId || 'NONE',
    activeTenantId: input.context?.activeTenantId || input.context?.tenantId || 'NONE',
    activeTenantName: input.context?.activeTenantName || input.context?.tenantName || 'NONE',
    activePropertyId: input.context?.activePropertyId || input.context?.propertyId || 'NONE',
    activeUnitId: input.context?.activeUnitId || input.context?.unitId || 'NONE',
    activeUnitNumber: input.context?.activeUnitNumber || input.context?.unitNumber || 'NONE',
    lastIntent: input.context?.lastIntent || input.context?.lockedState?.lockedIntent || 'NONE',
    executionHistory: input.context?.lockedState?.executionHistory || [],
  };

  const systemInstruction = [
    'ROLE: You are Aedra Assistant (WhatsApp).',
    'TASK: The user interacted with a menu / button flow. Something was incomplete, unexpected, or too simple.',
    'IMPORTANT: You MUST NOT execute tools or provide a plan.',
    'You may ONLY propose up to 3 next actions that REQUIRE user permission.',
    'Each proposed action must use an ALLOWED TOOL and must include concrete args (IDs from context) when available.',
    'If required args are missing, do NOT propose the tool; instead ask a question to collect the missing detail.',
    'Never use placeholders like PENDING/NONE/UNKNOWN in args.',
    'Output MUST be valid JSON only. No markdown fences.',
    'SCHEMA:',
    '{ "text": "string", "suggestions": [ { "label": "string", "tool": "string", "args": {} } ] }',
  ].join('\n');

  const prompt = [
    `Language: ${input.language} `,
    `AllowedTools: ${JSON.stringify(tools)} `,
    `Context: ${JSON.stringify(safeContext)} `,
    `LastAction: ${JSON.stringify(input.lastAction || null)} `,
    `LastToolResult: ${JSON.stringify(input.lastResult || null).substring(0, 2500)} `,
    `LastRenderedText: ${JSON.stringify(input.formattedText || '').substring(0, 1500)} `,
    `UserMessage: ${JSON.stringify(input.userMessage)} `,
    '',
    'Write a short helpful message explaining what happened and ask permission to proceed with one of the suggested actions.',
  ].join('\n');

  try {
    const response = await this.callLLMWithFailover(
      prompt,
      history || [],
      this.primaryModel,
      0.2,
      systemInstruction,
    );

    try {
      const jsonContent = (response.match(/```json\s * ([\s\S] *?) \s * ```/) || [null, response])[1] || response;
      const parsed = JSON.parse(String(jsonContent).trim());
      const text = typeof parsed?.text === 'string' ? parsed.text.trim() : '';
      const suggestionsRaw = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
      const suggestions = suggestionsRaw
        .filter((s: any) => s && typeof s.label === 'string' && typeof s.tool === 'string')
        .map((s: any) => ({
          label: String(s.label).slice(0, 20),
          tool: String(s.tool).trim(),
          args: s.args && typeof s.args === 'object' ? s.args : {},
        }))
        .filter((s: any) => tools.includes(s.tool))
        .slice(0, 3);

      const safeText =
        text ||
        (input.language === 'sw'
          ? 'Nimeona hilo. Ungependa niendelee na hatua ipi?'
          : 'I see that. Which option would you like me to proceed with?');

      return { text: safeText, suggestions };
    } catch(parseError) {
      const msg = (parseError as any)?.message || String(parseError);
      this.logger.warn(`[TakeoverAdvice] JSON parse failed: ${msg}. Attempting repair...`);

      const repairPrompt = [
        'Return ONLY valid JSON that matches the schema exactly. No markdown.',
        `Invalid output: ${JSON.stringify(response).substring(0, 2500)} `,
      ].join('\n');
      const repaired = await this.callLLMWithFailover(
        repairPrompt,
        history || [],
        this.primaryModel,
        0.0,
        systemInstruction,
      );
      const repairedContent = (repaired.match(/```json\s * ([\s\S] *?) \s * ```/) || [null, repaired])[1] || repaired;
      const parsed = JSON.parse(String(repairedContent).trim());
      const text = typeof parsed?.text === 'string' ? parsed.text.trim() : '';
      const suggestionsRaw = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
      const suggestions = suggestionsRaw
        .filter((s: any) => s && typeof s.label === 'string' && typeof s.tool === 'string')
        .map((s: any) => ({
          label: String(s.label).slice(0, 20),
          tool: String(s.tool).trim(),
          args: s.args && typeof s.args === 'object' ? s.args : {},
        }))
        .filter((s: any) => tools.includes(s.tool))
        .slice(0, 3);

      const safeText =
        text ||
        (input.language === 'sw'
          ? 'Nimeona hilo. Ungependa niendelee na hatua ipi?'
          : 'I see that. Which option would you like me to proceed with?');

      return { text: safeText, suggestions };
    }
  } catch(e: any) {
    this.logger.error(`[TakeoverAdvice] Failed: ${e.message} `);
    const fallback =
      input.language === 'sw'
        ? 'Samahani—kuna hitilafu kidogo. Ungependa niunde ripoti kamili au nichuje kwa property/tenant?'
        : 'Sorry—something went wrong. Would you like a full report, or should I filter by property/tenant?';
    return { text: fallback, suggestions: [] };
  }
}

  /**
   * Generates a final conversational summary that is strictly grounded in the Execution Trace.
   * High-stakes intents are routed deterministically. Low-stakes use the LLM with injected truth.
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
  immediateResponse ?: string,
  history: any[] = [],
  originalMessage ?: string
): Promise < string > {
  // Deterministic UX: if the user asked for a tenant by name and search returned nothing,
  // don't fall back to menus or unrelated lists.
  if(Array.isArray(steps) && steps.length === 1) {
  const s = steps[0];
  if (
    s?.tool === 'search_tenants' &&
    s?.success &&
    Array.isArray(s?.result) &&
    s.result.length === 0
  ) {
    const q =
      (s?.args?.query ||
        s?.args?.tenant_name ||
        s?.args?.tenantName ||
        (s?.result as any)?.__query ||
        originalMessage ||
        '')
        .toString()
        .trim();

    if (language === 'sw') {
      return q
        ? `🔍 Sijaona tenant anayelingana na “${q}”. Tafadhali tuma jina kamili, nambari ya simu, au ID number(au andika “list tenants” kuvinjari).`
        : '🔍 Sijaona tenant anayelingana na utafutaji huo. Tafadhali tuma jina kamili, nambari ya simu, au ID number (au andika “list tenants” kuvinjari).';
    }

    return q
      ? `🔍 I couldn’t find a tenant matching “${q}”. Reply with their full name, phone number, or ID number(or type “list tenants” to browse).`
      : '🔍 I couldn’t find a tenant matching that search. Reply with their full name, phone number, or ID number (or type “list tenants” to browse).';
  }
}

const HIGH_STAKES_INTENTS = [
  AiIntent.MAINTENANCE_REQUEST,
  AiIntent.MAINTENANCE,
  AiIntent.EMERGENCY,
  AiIntent.PAYMENT_PROMISE,
  AiIntent.FINANCIAL_QUERY,
  AiIntent.FINANCIAL_REPORTING,
  AiIntent.REVENUE_REPORT,
];

if (HIGH_STAKES_INTENTS.includes(intent)) {
  const allActionsSucceeded = (truthObject.actions?.length || 0) > 0 && truthObject.actions!.every(a => a.success);
  const hasData = truthObject.data?.balance !== undefined ||
    truthObject.data?.revenue !== undefined ||
    truthObject.data?.issueId !== undefined ||
    truthObject.data?.paymentHistory?.length > 0;

  if (truthObject.status === 'COMPLETE' && (allActionsSucceeded || hasData)) {
    return this.buildSuccessResponse(intent, truthObject, language);
  } else {
    return this.buildSafePartialResponse(intent, truthObject, language, immediateResponse);
  }
}

// Low-stakes: LLM with truth data injected
return this.safeLlmRender(intent, steps, language, virtualLedger, truthObject, role, errors, immediateResponse, history, originalMessage);
  }

  /**
   * Deterministic SUCCESS response for high-stakes intents.
   * Only called when truth.status === COMPLETE and all actions succeeded.
   */
  private buildSuccessResponse(intent: AiIntent, truth: TruthObject, language: string): string {
  const isSw = language === 'sw' || language === 'mixed';

  if (intent === AiIntent.PAYMENT_PROMISE) {
    const toolAction = truth.actions?.find((a) => a.tool === 'log_payment_promise');
    if (toolAction?.result?.clarificationNeeded && toolAction.result.message) {
      return toolAction.result.message;
    }

    const amount = truth.data?.amount || truth.data?.entities?.amount;
    const date = truth.data?.date || truth.data?.entities?.date;
    const amountStr = amount ? `KSh ${Number(amount).toLocaleString()} ` : 'the stated amount';
    const dateStr = date ? new Date(date).toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' }) : 'the agreed date';
    return isSw
      ? `Asante! Nimerekodi ahadi yako ya kulipa ${amountStr} tarehe ${dateStr}. Utapata ukumbusho siku moja kabla.`
      : `Thank you! I've logged your payment promise of ${amountStr} by ${dateStr}. You'll receive a reminder one day before.`;
  }

  if (intent === AiIntent.MAINTENANCE_REQUEST || intent === AiIntent.MAINTENANCE) {
    const toolAction = truth.actions?.find((a) => a.tool === 'log_maintenance_issue' || a.tool === 'create_maintenance_request');
    if (toolAction?.result?.clarificationNeeded && toolAction.result.message) {
      return toolAction.result.message;
    }

    const issueId = truth.data?.issueId;
    const isUrgent = truth.data?.isUrgent;
    const idText = issueId ? ` (Ticket #${issueId})` : '';
    return isSw
      ? `Nimefanikiwa kurekod ombi lako la matengenezo${idText}.Kipaumbele: ${isUrgent ? 'DHARURA' : 'KAWAIDA'}. Timu yetu itawasiliana nawe ndani ya masaa ${isUrgent ? '4' : '24'}.`
      : `Your maintenance request has been logged${idText}.Priority: ${isUrgent ? 'EMERGENCY' : 'NORMAL'}. Our team will contact you within ${isUrgent ? '4' : '24'} hours.`;
  }

  if (intent === AiIntent.EMERGENCY) {
    const issueId = truth.data?.issueId;
    return `🚨 EMERGENCY LOGGED${issueId ? ` (Ticket #${issueId})` : ''}. Our emergency crew has been dispatched and will be on - site within 2 hours.If the situation is life - threatening, please call emergency services immediately.`;
  }

  if (intent === AiIntent.FINANCIAL_QUERY) {
    const balance = truth.data?.balance ?? 0;
    const tenantName = truth.data?.searchedEntity?.name || truth.data?.tenantIdentity?.name || 'the tenant';
    const lastPayment = truth.data?.paymentHistory?.[0];
    const table = [
      `| ** Field ** | ** Details ** | `,
      `| : --- | : --- | `,
      `| ** Current Balance ** | KSh ${Number(balance).toLocaleString()} | `,
      `| ** Last Payment ** | ${lastPayment ? `KSh ${Number(lastPayment.amount || 0).toLocaleString()} (${new Date(lastPayment.date).toLocaleDateString()})` : 'None recorded'} | `,
      `| ** Account Status ** | ${truth.data?.status || 'Active'} | `,
    ].join('\n');
    return `Financial status for ** ${tenantName} **: \n\n${table} `;
  }

  if (intent === AiIntent.FINANCIAL_REPORTING || intent === AiIntent.REVENUE_REPORT) {
    const revenue = truth.data?.revenue;
    const rate = truth.data?.collectionRate;
    const reportUrl = truth.data?.reportUrl;
    let response = `Here is the financial summary you requested.`;
    if (revenue !== undefined) response += `\n\n ** Total Revenue:** KSh ${Number(revenue).toLocaleString()} `;
    if (rate !== undefined) response += `\n ** Collection Rate:** ${rate}% `;
    if (reportUrl) response += `\n\n[Download Full Report](${reportUrl})`;
    return response;
  }

  return `Your request has been completed successfully.`;
}

  /**
   * Deterministic PARTIAL/FAILURE response for high-stakes intents.
   * Never hallucinates — always honest about what failed and what is still needed.
   */
  private buildSafePartialResponse(
  intent: AiIntent,
  truth: TruthObject,
  language: string,
  immediateResponse ?: string,
): string {
  const isSw = language === 'sw' || language === 'mixed';
  const prefix = immediateResponse ? `${immediateResponse} \n\n` : '';

  if (intent === AiIntent.PAYMENT_PROMISE) {
    return isSw
      ? `${prefix}Asante kwa taarifa.Ili nirekodi ahadi yako vizuri, ninahitaji: (1) tarehe halisi ya malipo, na(2) kiasi halisi.Tafadhali toa maelezo hayo.`
      : `${prefix}Thank you for the update.To log your payment promise correctly, I need: (1) the exact payment date and(2) the exact amount.Please provide those details.`;
  }

  if (intent === AiIntent.MAINTENANCE_REQUEST || intent === AiIntent.MAINTENANCE) {
    return isSw
      ? `${prefix}Nimepokea taarifa yako.Ili nifungue tiketi, ninahitaji nambari ya unit yako(mfano: B4).Tafadhali ithibitishe.`
      : `${prefix}I've received your report. To open a maintenance ticket, I need your unit number (e.g. B4). Please confirm it.`;
  }

  if (intent === AiIntent.EMERGENCY) {
    return `${prefix}🚨 I've flagged this as an emergency. However, I could not log the full ticket automatically. Please call the emergency line immediately or confirm your unit number so I can escalate this to our on-call team.`;
  }

  if (intent === AiIntent.FINANCIAL_QUERY) {
    const entity = truth.data?.searchedEntity?.name || truth.data?.entities?.tenantName || 'the tenant';
    return `${prefix}I checked our records for **${entity}** but could not retrieve the complete financial details. This is a temporary system issue — please try again in a moment, or contact support if this persists.`;
  }

  if (intent === AiIntent.FINANCIAL_REPORTING || intent === AiIntent.REVENUE_REPORT) {
    return `${prefix}I checked but could not retrieve the complete financial report right now. This may be a temporary issue. Please try again, or contact support if it persists.`;
  }

  return `${prefix}I processed part of your request, but could not complete all steps. Please provide any missing details (such as your unit number, tenant name, or payment date) and I'll retry.`;
}

  /**
   * LLM rendering for low-stakes intents (GENERAL_QUERY, ONBOARDING, etc.)
   * Still injects truth data to prevent hallucination.
   */
  private async safeLlmRender(
  intent: AiIntent,
  steps: any[],
  language: string,
  virtualLedger: any,
  truthObject: TruthObject,
  role: UserRole,
  errors: string[],
  immediateResponse ?: string,
  history: any[] = [],
  originalMessage ?: string
): Promise < string > {
  const publicTruth = this.sanitizeForPublic(truthObject?.data || {});
  const publicSteps = (steps || []).filter(s => s.success).map(s => ({
    tool: s.tool,
    summary: this.sanitizeForPublic(s.result?.summary || s.result?.status || 'Completed')
  }));

  let emergencyInstructions = '';
  if(intent === AiIntent.EMERGENCY || truthObject.data?.isEmergency) {
  emergencyInstructions = `
      🚨 EMERGENCY SAFETY PROCEDURES (MANDATORY):
      - If the issue involves WATER: Instruct the user to SHUT OFF THE MAIN WATER VALVE immediately.
      - If the issue involves ELECTRICITY: Instruct the user to AVOID the area.
      - DO NOT ask for details until safety instructions are provided.
      `;
} else if (intent === AiIntent.UTILITY_OUTAGE || truthObject.data?.isUtilityOutage) {
  emergencyInstructions = `
      🚰 UTILITY OUTAGE GUIDELINES:
      - Acknowledge the outage.
      - Inform the user you are checking the building status.
      - Ask if neighbors are also affected.
      `;
}

const systemPrompt = `
      You are the DETERMINISTIC RENDERING ENGINE for Aedra.
      Your task is to convert the OPERATIONAL TRUTH into a natural language response.

      [ROLE]: ${role}
      [INTENT]: ${intent}
      [LANGUAGE]: ${language}
      [HISTORY_CONTEXT]: ${JSON.stringify(history.slice(-2))}
      [OPERATIONAL_TRUTH]: ${JSON.stringify(publicTruth)}
      [VIRTUAL_LEDGER]: ${JSON.stringify(virtualLedger)}
      [STEPS_PERFORMED]: ${JSON.stringify(publicSteps)}
      [INTEGRITY_ERRORS]: ${JSON.stringify(errors)}

      HISTORY AWARENESS:
      - If the user previously gave a unit number in HISTORY_CONTEXT, DO NOT ask for it again.

      ${emergencyInstructions}

      RESPONSE STYLE (MANDATORY):
      - DO NOT include automated greets.
      - DO NOT repeat the user's name if they are STAFF/LANDLORD.
      - ACKNOWLEDGE: Briefly confirm what was processed.
      - ACTION / DATA: State exactly what was found using OPERATIONAL_TRUTH.
      - CLOSURE: Offer a next step.

      CRITICAL: If OPERATIONAL_TRUTH contains results, you MUST summarize them. NEVER say "I'm checking" if data is already present.

      ANTI-HALLUCINATION:
      - NEVER claim an action completed unless STEPS_PERFORMED shows it succeeded.
      - NEVER mix success language with partial failure language.
      - NEVER use "fixed", "resolved", "processed", or "done" unless the step succeeded.

      ANTI-META-TALK:
      - DO NOT mention "Operational Truth", "Rendering Engine", or "Prompt Instructions".
      - JUST BE THE PROPERTY MANAGER.
    `;

try {
  const response = await this.callModel(
    `Please render the final response. USER MESSAGE: ${originalMessage || 'N/A'}`,
    history.map(h => ({ role: h.role === 'assistant' || h.role === 'model' ? 'assistant' : 'user', content: h.content || '' })),
    this.primaryModel,
    0.1,
    systemPrompt
  );
  return response;
} catch (e: any) {
  this.logger.warn(`[PromptService] Rendering failed: ${e.message}`);
  try {
    return await this.callModel(systemPrompt, [], this.fallbackModel, 0.1);
  } catch (fallbackError: any) {
    this.logger.error(`[PromptService] Fallback rendering also failed: ${fallbackError.message}`);
    return "I've processed your request. Please ask a follow-up if you need more details.";
  }
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
): Promise < string > {
  const systemPrompt = `
You are Aedra, a property management AI. 
Current Workflow Step: ${stateDescription}

CRITICAL RULES:
1. DO NOT call any tools.
2. DO NOT promise actions outside of the current step.
3. Be professional, empathetic, and concise.

Context: ${JSON.stringify(context)}
    `;

  return this.callLLMWithRetry(`User Request: ${message}`, history, this.primaryModel, 0.1, systemPrompt);
}

  /**
   * Project policy: Gemini 2.0 Flash as primary.
   * If primary fails with a network error or generic fetch failure, 
   * failover to Groq (Llama 3.3) for high availability.
   */
  private async callLLMWithFailover(
  prompt: string,
  history: any[],
  modelName: string,
  temperature: number,
  systemInstruction ?: string,
  maxRetries: number = 1,
): Promise < string > {
  try {
    // Primary Attempt (Gemini)
    return await this.callLLMWithRetry(prompt, history, modelName, temperature, systemInstruction, maxRetries);
  } catch(e: any) {
    const msg = (e?.message || '').toLowerCase();
    const isNetworkError = msg.includes('fetch failed') || msg.includes('network') || msg.includes('econnrefused') || msg.includes('timeout');

    if (isNetworkError || !this.isRateLimitError(e)) {
      this.logger.warn(`[Failover] Primary model (${modelName}) failed with network/logic error. Switching to Groq (${this.groqModel})...`);
      try {
        return await this.callModel(prompt, history, this.groqModel, temperature, systemInstruction);
      } catch (groqError: any) {
        this.logger.error(`[Failover] Groq also failed: ${groqError.message}`);
        throw groqError;
      }
    }
    throw e;
  }
}

  private async callLLMWithRetry(
  prompt: string,
  history: any[],
  modelName: string,
  temperature: number,
  systemInstruction ?: string,
  maxRetries: number = 2,
): Promise < string > {
  let lastError: any;
  for(let attempt = 0; attempt <= maxRetries; attempt++) {
  try {
    return await this.callModel(prompt, history, modelName, temperature, systemInstruction);
  } catch (e: any) {
    lastError = e;
    const msg = e?.message || String(e);
    this.logger.warn(`[LLM] ${modelName} attempt ${attempt + 1}/${maxRetries + 1} failed: ${msg}`);
    // Rate limiting is already handled with a longer backoff inside callModel()/withRetry().
    // Avoid compounding delays by retrying again at this outer layer.
    if (this.isRateLimitError(e)) {
      throw e;
    }
  }
}
throw lastError;
  }

  private isRateLimitError(error: any): boolean {
  const status = error?.status || error?.response?.status;
  if (status === 429) return true;
  const msg = (error?.message || '').toString().toLowerCase();
  return msg.includes('429') || msg.includes('too many requests') || msg.includes('resource exhausted');
}

  private async callModel(prompt: string, history: any[], modelName: string, temperature: number, systemInstruction ?: string): Promise < string > {
  const isGemini = modelName.includes('gemini');

  if(isGemini) {
    const model = this.genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: systemInstruction || undefined,
      generationConfig: {
        temperature,
        responseMimeType: (prompt.includes('{') && prompt.includes('}')) || (systemInstruction?.includes('JSON')) ? 'application/json' : 'text/plain'
      },
    });

    const contents = history.length > 0 ? [
      ...history.map(h => ({ role: h.role === 'assistant' || h.role === 'model' ? 'model' : 'user', parts: [{ text: h.content }] })),
      { role: 'user', parts: [{ text: prompt }] }
    ] : [{ role: 'user', parts: [{ text: prompt }] }];

    const result = await withRetry(
      () => model.generateContent({ contents }),
      {
        maxRetries: 5,
        // Prefer longer, regression-style backoff for quota/rate limiting (TPM/RPS).
        delaySequenceMs: [2000, 5000, 15000, 30000],
        initialDelay: 2000,
        maxDelay: 30000,
        retryableStatuses: [429, 502, 503, 504],
      },
    );
    return result.response.text();
  } else {
    const messages: any[] = [];
    if(systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }
      
      messages.push(...history.map(h => ({
      role: (h.role === 'assistant' || h.role === 'model' ? 'assistant' : 'user'),
      content: h.content || ''
    })));

    messages.push({ role: 'user', content: prompt });

    const completion = await withRetry(
      () => this.groq.chat.completions.create({ model: modelName, messages, temperature }),
      { maxRetries: 3, initialDelay: 400, maxDelay: 4000 },
    );
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
