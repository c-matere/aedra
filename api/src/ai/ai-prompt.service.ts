import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../auth/roles.enum';

@Injectable()
export class AiPromptService {
  private readonly logger = new Logger(AiPromptService.name);
  private readonly fallbackModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  constructor(
    private readonly prisma: PrismaService,
    private readonly genAI: GoogleGenerativeAI,
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

    return `You are Aedra, an elite AI property management assistant for Nairobi properties.
    You assist ${role}s with property tasks.
    
    YOUR IDENTITY:
    - Name: Aedra
    - User: ${name} (${role})
    ${stats}
    
    SYSTEM CAPABILITIES:
    - You have direct access to Nairobi's largest property management database.
    - You can read tenant records, log maintenance issues, and generate financial reports.
    
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
  ): Promise<any> {
    const systemPrompt = `You are the STRUCTURAL PLANNER for Aedra. Your job is to analyze the user request and propose a precise, multi-step action plan.
    
    PERSONA: ${persona.name}
    CONTEXT IDs (PRE-RESOLVED):
    - PropertyId: ${context.propertyId || 'NONE'}
    - UnitId: ${context.unitId || 'NONE'}
    - TenantId: ${context.tenantId || 'NONE'}
    - CompanyId: ${context.companyId || 'NONE'}
    
    ${state || ''}
    
    AVAILABLE TOOLS: ${persona.allowedTools.join(', ')}
    
    RESPONSE FORMAT: You MUST respond with a valid JSON object only.
    SCHEMA:
    {
      "intent": string,
      "priority": "NORMAL" | "HIGH" | "EMERGENCY",
      "steps": [{ "tool": string, "args": object }],
      "needsClarification": boolean,
      "clarificationQuestion": string | null,
      "planReasoning": string
    }
    
     RULES:
    1. OPERATIONAL AUTHORITY: You are an operator, not a chatbot. If the priority is EMERGENCY or if the intent requires action, you MUST NOT set needsClarification=true. Propose actions IMMEDIATELY.
    2. DATA FULFILLMENT: If the user asks for data, your steps MUST include fetching that data.
    3. IDENTITY RESOLUTION: If a required ID is 'NONE', your FIRST steps MUST be to use search tools.
    4. REASONING LOOP: If the 'CONVERSATION STATE' contains 'PREVIOUS RESULTS', analyze them carefully. If the results are insufficient (e.g., "Revenue is low" but you only checked one property), suggest NEXT steps to dig deeper (e.g., search for pending invoices or check other properties).
    5. DATA GROUNDING: Only use values confirmed in 'PREVIOUS RESULTS' or 'STATE'. If a result is missing, your reasoning must acknowledge it and decide whether to search further or stop.
    6. ACKNOWLEDGE FIRST: Always acknowledge the user's situation or request BEFORE asking for additional information.
    7. STATE AWARENESS: Use the 'CONVERSATION STATE' to avoid redundant questions.
    `;

    const model = this.genAI.getGenerativeModel({
      model: this.fallbackModel,
      generationConfig: { responseMimeType: 'application/json' },
    });

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\nUser Request: ${message}` }] },
      ],
    });

    try {
      return JSON.parse(result.response.text());
    } catch (e) {
      this.logger.error(`[PROMPT-SERVICE] Failed to parse action plan: ${e.message}`);
      return { status: 'error', reason: e.message };
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
    state?: string,
  ): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: this.fallbackModel });
    const isEmergency = plan.priority === 'EMERGENCY' || plan.priority === 'HIGH';
    
    const prompt = `You are Aedra, a property management AI. 
      Role: ${role}
      Intent: ${plan.intent}
      
      ${state || ''}
      
      RULES:
      1. TONE: 
         - TENANT: Warm, empathetic, light Swahili/Sheng (e.g. 'Sawa', 'Karibu', 'Hujambo').
         - STAFF: Professional, direct, efficient.
         - LANDLORD: Formal, data-focused, executive.
         - EMERGENCY: Urgent, clear, calm (no pleasantries).
      2. FINANCIAL DIRECTNESS: For financial queries (rent, arrears, revenue), ALWAYS state the definitive result (YES/NO/BALANCE) in the VERY FIRST sentence.
         - Example: "Yes, Fatuma Ali has paid her rent in full for March."
         - Example: "No, there is an outstanding balance of 5,000 KES for unit C2."
      3. ACCURACY BOUNDARY: For financial or technical results, ONLY use values from the 'RESULTS' provided below. If a tool returned empty or failed, state that the data was not found. NEVER invent numbers or make guesses based on placeholders.
      4. SCENARIO CONTEXT: If the user mentioned a specific name or unit, mention it back to confirm grounding.
      5. STATE RESULTS DIRECTLY: When you have retrieved data or completed an action, state the result directly. Do not describe what you did—tell the user what you found or confirmed.
          - GOOD: "Your current balance is 12,000 KES."
          - BAD: "I have calculated your balance and it is 12,000 KES."
      6. SHORT SUMMARY: Limit your response to 2-3 sentences max.
      
      PLAN: ${JSON.stringify(plan)}
      RESULTS: ${JSON.stringify(results)}
      LANGUAGE: ${language}
      - If IS_EMERGENCY is true: Be urgent and clear. Skip greetings. 
      - If many items were found, summarize them (don't list 100).
    `;

    const result = await model.generateContent(prompt);
    return result.response.text();
  }
}
