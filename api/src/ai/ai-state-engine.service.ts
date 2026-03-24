import { Injectable, Logger } from '@nestjs/common';
import { ContextMemoryService, SessionContext } from './context-memory.service';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiStateEngineService {
  private readonly logger = new Logger(AiStateEngineService.name);
  private readonly modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  constructor(
    private readonly contextMemory: ContextMemoryService,
    private readonly genAI: GoogleGenerativeAI,
  ) {}

  /**
   * Extracts potential state updates from a user message.
   * This is a "pre-planning" step to ensure the planner has a current view of the conversation subject.
   */
  async extractState(chatId: string, message: string, history: any[]): Promise<void> {
    const prompt = `Analyze the following user message and conversation history. 
    Identify if the user has confirmed or mentioned a specific Tenant Name, Unit Number (e.g. A1, 101), or a Maintenance Issue type.
    
    Current Message: "${message}"
    
    RESPONSE FORMAT: JSON only.
    {
      "tenantName": string | null,
      "unitNumber": string | null,
      "issueType": string | null
    }
    `;

    try {
      const model = this.genAI.getGenerativeModel({ 
        model: this.modelName,
        generationConfig: { responseMimeType: 'application/json' }
      });
      const result = await model.generateContent(prompt);
      const extracted = JSON.parse(result.response.text());

      const updates: Partial<SessionContext> = {};
      if (extracted.tenantName) updates.activeTenant = { id: 'PENDING', name: extracted.tenantName };
      if (extracted.unitNumber) updates.activeUnitId = extracted.unitNumber; // We use unitNumber as ID temporarily or for lookup
      if (extracted.issueType) updates.activeIssue = { id: 'PENDING', type: extracted.issueType, status: 'identified' };

      if (Object.keys(updates).length > 0) {
        await this.contextMemory.setContext(chatId, updates);
        this.logger.log(`[StateEngine] Extracted state for ${chatId}: ${JSON.stringify(updates)}`);
      }
    } catch (e) {
      this.logger.error(`[StateEngine] Failed to extract state: ${e.message}`);
    }
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
      if (res.tool === 'get_tenant_arrears' || res.tool === 'search_tenants') {
        const data = Array.isArray(res.result) ? res.result[0] : res.result;
        if (data?.id && data?.name) {
          updates.activeTenant = { 
            id: data.id, 
            name: data.name, 
            unit: data.unitNumber || data.unit?.number,
            arrears: data.arrears || data.balance
          };
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
