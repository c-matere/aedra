import { Injectable, Logger } from '@nestjs/common';
import { UserRole } from '../auth/roles.enum';
import { AiReadToolService } from './ai-read-tool.service';
import { AiWriteToolService } from './ai-write-tool.service';
import { AiReportToolService } from './ai-report-tool.service';
import { AiHistoryToolService } from './ai-history-tool.service';
import { AutonomousAgentService } from './autonomous-agent.service';

@Injectable()
export class AiToolRegistryService {
  private readonly logger = new Logger(AiToolRegistryService.name);

  constructor(
    private readonly readTools: AiReadToolService,
    private readonly writeTools: AiWriteToolService,
    private readonly reportTools: AiReportToolService,
    private readonly historyTools: AiHistoryToolService,
    private readonly autonomousAgentService: AutonomousAgentService,
  ) {}

  async executeTool(
    name: string,
    args: any,
    context: any,
    role: UserRole,
    language: string,
  ): Promise<any> {
    this.logger.log(`Executing tool: ${name}`);

    // Agent Tools delegation
    if (name === 'analyze_agent_goal') {
      return await this.autonomousAgentService.analyzeGoal(context);
    }
    if (name === 'evaluate_agent_progress') {
      return await this.autonomousAgentService.evaluateProgress(context);
    }
    if (name === 'process_agent_feedback') {
      return await this.autonomousAgentService.processFeedback(context);
    }
    if (name === 'notify_agent_plan') {
      return await this.autonomousAgentService.notifyPlan(context);
    }
    if (name === 'send_agent_heartbeat') {
      return await this.autonomousAgentService.sendHeartbeatUpdate(context);
    }

    if (name === 'execute_agent_chunk') {
      const plan = context.analyze_goal;
      if (!plan || !plan.tasks) {
        return { error: 'No agent plan found in context.analyze_goal' };
      }

      const nextTask = plan.tasks.find((t: any) => t.status === 'pending');
      if (!nextTask) {
        return { success: true, message: 'All tasks completed.' };
      }

      this.logger.log(`[Agent] Executing chunked task: ${nextTask.action}`);
      try {
        const result = await this.executeTool(
          nextTask.action,
          nextTask.args,
          context,
          role,
          language,
        );
        nextTask.status = 'done';
        nextTask.result = result;
        return {
          success: true,
          action: nextTask.action,
          result,
          remaining: plan.tasks.filter((t: any) => t.status === 'pending').length,
        };
      } catch (error) {
        this.logger.error(`[Agent] Task ${nextTask.action} failed: ${error.message}`);
        nextTask.status = 'failed';
        nextTask.error = error.message;
        throw error;
      }
    }

    // Routing logic based on tool categories
    if (this.isReadTool(name)) {
      return await this.readTools.executeReadTool(
        name,
        args,
        context,
        role,
        language,
      );
    }

    if (
      name.includes('_report') ||
      name.includes('_staged') ||
      name === 'register_company' ||
      name === 'process_risk_analysis'
    ) {
      return await this.reportTools.executeReportTool(
        name,
        args,
        context,
        role,
        language,
      );
    }

    if (
      name === 'view_version_history' ||
      name === 'view_portfolio_history' ||
      name === 'generate_history_pdf' ||
      name === 'rollback_change'
    ) {
      return await this.historyTools.executeHistoryTool(
        name,
        args,
        context,
        role,
      );
    }

    // Default to write tools for everything else (mutative)
    return await this.writeTools.executeWriteTool(
      name,
      args,
      context,
      role,
      language,
    );
  }

  /**
   * Identifies tools that provide "LOCKED" ground-truth data (e.g. financial or core property status).
   * These outputs must be strictly bound to the final response to prevent hallucinations.
   */
  isAuthoritative(name: string): boolean {
    const authoritativeTools = [
      'get_tenant_arrears',
      'list_payments',
      'get_unit_details',
      'get_lease_details',
      'get_collection_rate',
      'get_maintenance_status',
      'get_occupancy_stats',
      'search_tenants',
    ];
    return authoritativeTools.includes(name);
  }

  private isReadTool(name: string): boolean {
    const readPrefixes = ['list_', 'get_', 'search_', 'view_'];
    const isRead =
      readPrefixes.some((p) => name.startsWith(p)) ||
      name === 'select_company' ||
      name === 'generate_execution_plan' ||
      name === 'detect_duplicates';

    // Exceptions that start with read prefixes but are mutative/staged
    const exceptions = [
      'list_tenants_staged',
      'list_payments_staged',
      'list_invoices_staged',
      'view_version_history',
      'view_portfolio_history',
      'generate_history_pdf',
    ];
    if (exceptions.includes(name)) return false;

    return isRead;
  }
}
