import { Injectable, Logger } from '@nestjs/common';
import { ContextMemoryService, SessionContext } from './context-memory.service';

@Injectable()
export class AiStateEngineService {
  private readonly logger = new Logger(AiStateEngineService.name);

  constructor(
    private readonly contextMemory: ContextMemoryService,
  ) {}

  /**
   * Extracts potential state updates from a user message.
   * Reasoning is now handled by the standalone Brain service.
   * We keep only basic regex anchoring here for immediate context resolution.
   */
  async extractState(
    chatId: string,
    message: string,
    _history: any[],
  ): Promise<void> {
    try {
      // REGEX GUARDIAN (Immediate context resolution for short/Swahili messages)
      const text = message.toLowerCase();
      const unitMatch =
        text.match(
          /(?:unit|nyumba|house|room|nipo)\s*(?:no\.?|number|#)?\s*([a-z0-9]{1,4})/i,
        ) || text.match(/\b([a-z]\d{1,3})\b/i); // Matches B4, C21, A0

      if (unitMatch) {
        const resolvedUnit = unitMatch[1].toUpperCase();
        await this.contextMemory.setContext(chatId, {
          activeUnitId: resolvedUnit,
        });
        this.logger.log(
          `[StateEngine] Regex Guardian resolved unit: ${resolvedUnit}`,
        );
      }
    } catch (e) {
      this.logger.error(`[StateEngine] Failed to extract state: ${e.message}`);
    }
  }

  /**
   * Resolves the primary intent by combining message classification and state history.
   */
  async resolveIntent(
    chatId: string,
    _message: string,
    classification: any,
  ): Promise<string> {
    const context = await this.contextMemory.getContext(chatId);

    // If classification is weak but we have a lastIntent, favor the lastIntent (Intent Continuity)
    if (classification.confidence < 0.6 && context.lastIntent) {
      this.logger.log(
        `[StateEngine] Weak classification (${classification.intent}), anchoring to last intent: ${context.lastIntent}`,
      );
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
      if (
        res.tool === 'get_tenant_arrears' ||
        res.tool === 'search_tenants' ||
        res.tool === 'get_tenant_details'
      ) {
        const data = Array.isArray(res.result) ? res.result[0] : res.result;
        if (data?.id) {
          updates.activeTenant = {
            id: data.id,
            name:
              data.name ||
              (data.firstName
                ? `${data.firstName} ${data.lastName}`
                : updates.activeTenant?.name),
            unit:
              data.unitNumber ||
              data.unit?.number ||
              data.unit?.unitNumber ||
              updates.activeTenant?.unit,
            arrears: data.arrears !== undefined ? data.arrears : data.balance,
          };
        }
      }

      // Chain of Discovery: Extract tenant from Unit Details
      if (res.tool === 'get_unit_details') {
        const unit = res.result;
        if (
          unit?.leases &&
          Array.isArray(unit.leases) &&
          unit.leases.length > 0
        ) {
          const activeLease = unit.leases.find(
            (l: any) => l.status === 'ACTIVE' || !l.status,
          );
          if (activeLease?.tenant) {
            updates.activeTenant = {
              id: activeLease.tenant.id,
              name: `${activeLease.tenant.firstName} ${activeLease.tenant.lastName}`,
              unit: unit.unitNumber,
              arrears: activeLease.balance,
            };
            this.logger.log(
              `[StateEngine] Discovered tenant ${updates.activeTenant.name} via Unit ${unit.unitNumber}`,
            );
          }
        }
      }

      // Extract Issue Info
      if (
        res.tool === 'log_maintenance_request' ||
        res.tool === 'get_maintenance_status'
      ) {
        const data = res.result;
        if (data?.id) {
          updates.activeIssue = {
            id: data.id,
            type: data.category || data.type,
            status: data.status,
            unit: data.unitNumber,
          };
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      await this.contextMemory.setContext(chatId, updates);
      this.logger.log(
        `[StateEngine] Updated state from results for ${chatId}: ${JSON.stringify(updates)}`,
      );
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
      if (context.activeTenant.arrears !== undefined)
        stateStr += `, Arrears: ${context.activeTenant.arrears} KES`;
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
