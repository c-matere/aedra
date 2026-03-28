import { Injectable, Logger } from '@nestjs/common';
import { ContextMemoryService, SessionContext } from './context-memory.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

@Injectable()
export class AiStateEngineService {
  private readonly logger = new Logger(AiStateEngineService.name);
  private readonly primaryModel = 'gemini-2.0-flash';
  private readonly fallbackModel = 'llama-3.1-8b-instant';

  constructor(
    private readonly contextMemory: ContextMemoryService,
    private readonly genAI: GoogleGenerativeAI,
    private readonly groq: Groq,
  ) {}

  /**
   * Extracts potential state updates from a user message.
   * This is a "pre-planning" step to ensure the planner has a current view of the conversation subject.
   */
  async extractState(chatId: string, message: string, history: any[]): Promise<void> {
    const context = await this.contextMemory.getContext(chatId);
    
    // INTENT ANCHORING: Provide the last intent to help the model resolve fragments (e.g. "C2" -> Unit selection for "Report Leak")
    const prompt = `Analyze the user message for property management context. 
    CURRENT CONTEXT:
    - Last Intent: ${context.lastIntent || 'NONE'}
    - Active Unit: ${context.activeUnitId || 'NONE'}
    - Active Tenant: ${context.activeTenant?.name || 'NONE'}
    
    User Message: "${message}"
    
    EXTRACT:
    - tenantName: if mentioned or confirmed.
    - unitNumber: if mentioned. Look for patterns like "B4", "C2", "unit 5", "A0". In Swahili: "nipo B4" means Unit B4.
    - issueType: if mentioned (leak, blockage, penalty, etc).
    - intent: if the user is switching topics (e.g., from repair to arrears). Output "CONTINUE" if they are just providing details for the current task.
    
    RESPONSE FORMAT: JSON only.
    {
      "tenantName": string | null,
      "unitNumber": string | null,
      "issueType": string | null,
      "intent": string | "CONTINUE"
    }
    `;

    try {
      // 1. Gemini (Primary)
      let extracted: any = null;
      try {
        const model = this.genAI.getGenerativeModel({ 
          model: this.primaryModel,
          generationConfig: { responseMimeType: 'application/json' }
        });
        const result = await model.generateContent(prompt);
        extracted = JSON.parse(result.response.text());
      } catch (e) {
        this.logger.warn(`[StateEngine] Tier 1 (Gemini 2.5 Pro) extraction failed, trying Tier 2 (Groq Llama): ${e.message}`);
      }

      // 2. Groq - Llama (Tier 2)
      if (!extracted) {
        try {
          const completion = await this.groq.chat.completions.create({
            model: this.fallbackModel,
            messages: [
              { role: 'system', content: 'You are a state extraction assistant. Respond ONLY with valid JSON.' },
              { role: 'user', content: prompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
          });
          extracted = JSON.parse(completion.choices[0]?.message?.content || '{}');
        } catch (e) {
          this.logger.warn(`[StateEngine] Tier 2 (Llama) extraction failed, trying Tier 3 (GPT OSS): ${e.message}`);
        }
      }

      // 3. Groq - GPT OSS (Tier 3 Fallback)
      if (!extracted) {
        try {
          const completion = await this.groq.chat.completions.create({
            model: this.primaryModel, // Using primaryModel for GPT OSS
            messages: [
              { role: 'system', content: 'You are a state extraction assistant. Respond ONLY with valid JSON.' },
              { role: 'user', content: prompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
          });
          extracted = JSON.parse(completion.choices[0]?.message?.content || '{}');
        } catch (e) {
          this.logger.error(`[StateEngine] All extraction tiers failed: ${e.message}`);
        }
      }

      const updates: Partial<SessionContext> = {};
      if (extracted.tenantName) updates.activeTenant = { ...context.activeTenant, id: context.activeTenant?.id || 'PENDING', name: extracted.tenantName };
      if (extracted.unitNumber) updates.activeUnitId = extracted.unitNumber;
      if (extracted.issueType) updates.activeIssue = { ...context.activeIssue, id: context.activeIssue?.id || 'PENDING', type: extracted.issueType, status: context.activeIssue?.status || 'identified' };
      
      if (extracted.intent && extracted.intent !== 'CONTINUE') {
        updates.lastIntent = extracted.intent;
      }

      if (Object.keys(updates).length > 0) {
        await this.contextMemory.setContext(chatId, updates);
        this.logger.log(`[StateEngine] Extracted state for ${chatId}: ${JSON.stringify(updates)}`);
      }

      // 4. REGEX FALLBACK (Guardian for short/Swahili messages)
      const text = message.toLowerCase();
      const unitMatch = text.match(/(?:unit|nyumba|house|room|nipo)\s*(?:no\.?|number|#)?\s*([a-z0-9]{1,4})/i) 
                    || text.match(/\b([a-z]\d{1,3})\b/i); // Matches B4, C21, A0
      
      if (unitMatch && !updates.activeUnitId) {
        const resolvedUnit = unitMatch[1].toUpperCase();
        await this.contextMemory.setContext(chatId, { activeUnitId: resolvedUnit });
        this.logger.log(`[StateEngine] Regex Guardian resolved unit: ${resolvedUnit}`);
      }
    } catch (e) {
      this.logger.error(`[StateEngine] Failed to extract state: ${e.message}`);
    }
  }

  /**
   * Resolves the primary intent by combining message classification and state history.
   */
  async resolveIntent(chatId: string, message: string, classification: any): Promise<string> {
    const context = await this.contextMemory.getContext(chatId);
    
    // If classification is weak but we have a lastIntent, favor the lastIntent (Intent Continuity)
    if (classification.confidence < 0.6 && context.lastIntent) {
      this.logger.log(`[StateEngine] Weak classification (${classification.intent}), anchoring to last intent: ${context.lastIntent}`);
      return context.lastIntent;
    }
    
    return classification.intent;
  }

  /**
   * Updates the structured state based on actual tool execution results.
   * This is the "ground truth" update.
   */
  async updateFromResults(chatId: string, results: any[]): Promise<void> {
    const updates: Partial<SessionContext> = {};

    for (const res of results) {
      if (!res.success || !res.result) continue;

      // Extract Tenant Info
      if (res.tool === 'get_tenant_arrears' || res.tool === 'search_tenants' || res.tool === 'get_tenant_details') {
        const data = Array.isArray(res.result) ? res.result[0] : res.result;
        if (data?.id) {
          updates.activeTenant = { 
            id: data.id, 
            name: data.name || (data.firstName ? `${data.firstName} ${data.lastName}` : updates.activeTenant?.name), 
            unit: data.unitNumber || data.unit?.number || data.unit?.unitNumber || updates.activeTenant?.unit,
            arrears: data.arrears !== undefined ? data.arrears : data.balance
          };
        }
      }

      // Chain of Discovery: Extract tenant from Unit Details
      if (res.tool === 'get_unit_details') {
        const unit = res.result;
        if (unit?.leases && Array.isArray(unit.leases) && unit.leases.length > 0) {
          const activeLease = unit.leases.find((l: any) => l.status === 'ACTIVE' || !l.status);
          if (activeLease?.tenant) {
            updates.activeTenant = {
              id: activeLease.tenant.id,
              name: `${activeLease.tenant.firstName} ${activeLease.tenant.lastName}`,
              unit: unit.unitNumber,
              arrears: activeLease.balance
            };
            this.logger.log(`[StateEngine] Discovered tenant ${updates.activeTenant.name} via Unit ${unit.unitNumber}`);
          }
        }
      }

      // Extract Issue Info
      if (res.tool === 'log_maintenance_request' || res.tool === 'get_maintenance_status') {
        const data = res.result;
        if (data?.id) {
          updates.activeIssue = {
            id: data.id,
            type: data.category || data.type,
            status: data.status,
            unit: data.unitNumber
          };
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      await this.contextMemory.setContext(chatId, updates);
      this.logger.log(`[StateEngine] Updated state from results for ${chatId}: ${JSON.stringify(updates)}`);
    }
  }

  /**
   * Formats the current state as a string for inclusion in AI prompts.
   */
  async getFormattedState(chatId: string): Promise<string> {
    const context = await this.contextMemory.getContext(chatId);
    
    let stateStr = '\nCONVERSATION STATE:\n';
    if (context.activeTenant) {
      stateStr += `- Active Tenant: ${context.activeTenant.name} (ID: ${context.activeTenant.id})`;
      if (context.activeTenant.arrears !== undefined) stateStr += `, Arrears: ${context.activeTenant.arrears} KES`;
      stateStr += '\n';
    }
    if (context.activeUnitId) {
      stateStr += `- Active Unit: ${context.activeUnitId}\n`;
    }
    if (context.activeIssue) {
      stateStr += `- Active Issue: ${context.activeIssue.type} (Status: ${context.activeIssue.status}, ID: ${context.activeIssue.id})\n`;
    }
    
    return stateStr === '\nCONVERSATION STATE:\n' ? '' : stateStr;
  }
}
