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
  private readonly fallbackModel = 'gemini-1.5-flash';

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
        { "tool": "search_tenants", "args": { "tenant_name": "Fatuma Ali" }, "required": true },
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
        { "tool": "search_tenants", "args": { "tenant_name": "Fatuma Ali" }, "required": true },
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
      "immediateResponse": "I'm generating the monthly summary report for your entire portfolio now.",
      "entities": { "propertyName": "Portfolio" },
      "steps": [
        { "tool": "generate_mckinsey_report", "args": { "propertyName": "Portfolio" }, "required": true }
      ],
      "planReasoning": "The Landlord requested a monthly summary. Since no specific property was mentioned, I am generating a portfolio-level McKinsey report."
    }

    User: "shida gani hii? report haitaki kudownload"
    Plan: {
      "intent": "SYSTEM_FAILURE",
      "priority": "HIGH",
      "language": "sw",
      "immediateResponse": "Napenda kutoa radhi kwa hitilafu ya kudownload ripoti. Timu yetu ya ufundi inaishughulikia hitilafu hii mara moja. Sawa, I've logged this as a system failure. Our technical crew is already investigating the download issue.",
      "entities": {},
      "steps": [],
      "planReasoning": "The Landlord reported a download failure. This is a technical system issue. I must acknowledge the frustration, apologize officially, and state that the technical team is on it."
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
    1. EXTREME (STRUCTURAL/FIRE): Fire, flooding, gas. Immediate safety response.
    2. HIGH (UTILITIES/SECURITY): No water, no power, broken lock. 4-24hr fix.
    3. NORMAL (OPERATIONAL): Noisy neighbor, dirty wall, trash. 24-72hr fix.
    4. LOW (INFO): Requesting receipt, asking for current unit, general query.
    
    CONTEXTUAL PERSISTENCE:
    - ALWAYS look at History Context. If the user previously mentioned a problem (e.g., "jiko inaleak") and now gives a detail (e.g., "B4"), the intent is STILL the previous problem. Use previous entities in new tool steps.

    TECHNICAL SUPPORT:
    - Trigger: Explicit technical words like "error", "failure", "hitilafu", "system broken", "cannot download".
    - Action: Apologize ("Pole sana"), state "Technical Team notified", and log SYSTEM_FAILURE.
    - RULE: DO NOT use for missing data (e.g., "I don't see X"). Use tools to find data first.

    MOVE-OUT PROTOCOL:
    - For all move-out or termination queries, ALWAYS include 'get_lease_details' in your steps to verify the notice period and penalty clauses.
    - Reference the 30-day notice requirement (Standard Policy) if specific lease data is pending.
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
    - TenantName: ${context.tenantName || context.activeTenantName || context.lockedState?.activeTenantName || 'NONE'}
    - UnitId: ${context.unitId || 'NONE'}
    - UnitNumber: ${context.unitNumber || context.activeUnitNumber || context.lockedState?.activeUnitNumber || 'NONE'}
    - PropertyId: ${context.propertyId || context.activePropertyId || context.lockedState?.activePropertyId || 'NONE'}
    - CompanyId: ${context.companyId || 'NONE'}
    - LastIdentities: ${JSON.stringify(context.lastIdentities || [])}
    
    AVAILABLE TOOLS: [${tools.join(', ')}]
    `;

    const instructions = "\nCRITICAL: Always include 'intent' and 'steps' fields in the root of the JSON object. Do NOT wrap in a 'plan' object. If a tenant name (e.g. Fatuma Ali) is mentioned but you don't have their ID, you MUST call 'search_tenants' first. NEVER use 'NONE' for required UUIDs. NEVER use {{curly_braces}} in arguments. If the user provides a unit number for a previous complaint in history, USE that unitNumber in 'log_maintenance_issue'.";
    const combinedSystemPrompt = rolePrompt + contextPart + instructions;

    try {
      // 1. Primary Model (Tier 1)
      const response = await this.callModel(`User Message: "${message}"`, history, this.primaryModel, 0.1, combinedSystemPrompt);
      
      try {
        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || [null, response];
        const jsonContent = jsonMatch[1] || response;
        const rawPlan = JSON.parse(jsonContent.trim());
        return this.validatePlan(rawPlan);
      } catch (parseError) {
        this.logger.warn(`[UnifiedPlanner] Tier 1 (${this.primaryModel}) parsing failed: ${parseError.message}. Escalating to Tier 2...`);
        
        // 2. Fallback Model (Tier 2)
        const fbResponse = await this.callModel(`User Request: ${message}`, history, this.fallbackModel, 0.1, combinedSystemPrompt);
        const fbJsonMatch = fbResponse.match(/```json\s*([\s\S]*?)\s*```/) || [null, fbResponse];
        const fbJsonContent = fbJsonMatch[1] || fbResponse;
        const fbRawPlan = JSON.parse(fbJsonContent.trim());
        return this.validatePlan(fbRawPlan);
      }
    } catch (e: any) {
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
    immediateResponse?: string,
    history: any[] = [],
    originalMessage?: string
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
      [HISTORY_CONTEXT]: ${JSON.stringify(history.slice(-2))}
      [OPERATIONAL_TRUTH]: ${JSON.stringify(publicTruth)}
      [VIRTUAL_LEDGER]: ${JSON.stringify(virtualLedger)}
      [STEPS_PERFORMED]: ${JSON.stringify(publicSteps)}
      [INTEGRITY_ERRORS]: ${JSON.stringify(errors)}
      
      HISTORY AWARENESS:
      - If the user previously gave a unit number (e.g., "B4") in HISTORY_CONTEXT, DO NOT ask for it again.
      - If you are still missing information, check if it was already provided in history.
      
      ${isBlocked ? `
      [🚨 STATUS: BLOCKED 🚨]
      The request current state is INCOMPLETE due to these specific blockers:
      ${blockErrors.map((e: string) => `- ${e}`).join('\n')}
      ` : ''}

      ${emergencyInstructions}
      
      RESPONSE STYLE (MANDATORY):
      Your response MUST follow a natural human flow and MUST include the data from OPERATIONAL_TRUTH.
      - DO NOT include any automated greets like "Hello [searchedEntity]".
      - DO NOT repeat the user's name if they are STAFF/LANDLORD.
      - 1. ACKNOWLEDGE: Briefly confirm you have processed the request.
      - 2. ACTION TAKEN / DATA FOUND: Using the specific tool 'RESULTS' (OPERATIONAL_TRUTH), state EXACTLY what was found.
        - If 'tenant_arrears' are found, you MUST state the exact amount and currency.
        - If 'revenue' figures are found, you MUST state the totals.
        - If unit status was checked, state if it is Vacant or Occupied.
      - 3. PROACTIVE CLOSURE: Offer a solution or next step based on the data.
      
      CRITICAL: If OPERATIONAL_TRUTH contains a non-empty result (e.g. data for a tenant, property, or report), you MUST summarize that data. NEVER say "I'm checking" or "I'll generate" in the final response if the data is already in OPERATIONAL_TRUTH. Say "I have found..." or "The current revenue for Palm Grove is...". If tool results are available, presenting them is the priority.
      
      ACTION INTEGRITY:
      - If 'STEPS_PERFORMED' show success for log_maintenance_issue, ALWAYS state the ticket has been logged and provide a realistic 4-24 hour timeline for Nairobi vendors.
      - If 'OPERATIONAL_TRUTH' shows 'ENTITY_NOT_FOUND', say "I couldn't locate those details. I checked for [EntityName] but no record exists."
      - DO NOT use technical terms like "unverified", "null", or "undefined".
      
      OUTCOME-DRIVEN TEMPLATES (v5.6 - DATA FORCING):
      - FINANCIAL/REVENUE: "Hali ya mapato ya [Property] ni [Amount]. Hapa kuna mchanganuo: [Data Table]" + (If reportUrl exists: "\n\nYou can download the full report here: [reportUrl]")
      - MAINTENANCE: "I've logged your request for [Issue] for Unit [Unit]. A technician will contact you within 24 hours."
      - INCONSISTENCY: "I found a discrepancy: [Detail]. I have flagged this for an audit."
      - ONBOARDING: "Success! [TenantName] has been registered for unit [UnitNumber]."
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
      const response = await this.callModel(
        `Please render the final response for the user based on the truth provided. USER MESSAGE: ${originalMessage || 'N/A'}`, 
        history.map(h => ({ role: h.role === 'assistant' || h.role === 'model' ? 'assistant' : 'user', content: h.content || '' })), 
        this.primaryModel, 
        0.1,
        systemPrompt
      );
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

    return this.callModel(`User Request: ${message}`, history, 'gemini-2.0-flash', 0.1, systemPrompt);
  }

  private async callModel(prompt: string, history: any[], modelName: string, temperature: number, systemInstruction?: string): Promise<string> {
    const isGemini = modelName.includes('gemini');
    
    if (isGemini) {
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

      const result = await model.generateContent({ contents });
      return result.response.text();
    } else {
      const messages: any[] = [];
      if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
      }
      
      messages.push(...history.map(h => ({ 
        role: (h.role === 'assistant' || h.role === 'model' ? 'assistant' : 'user'), 
        content: h.content || '' 
      })));
      
      messages.push({ role: 'user', content: prompt });

      const completion = await this.groq.chat.completions.create({
        model: modelName,
        messages,
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
