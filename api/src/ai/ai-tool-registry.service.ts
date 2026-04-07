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

  private readonly ROLE_TOOL_ALLOWLIST: Record<string, string[]> = {
    [UserRole.TENANT]: [
      'get_unit_details', 'get_tenant_details', 'get_tenant_arrears',
      'list_payments', 'list_invoices', 'get_lease_details',
      'log_maintenance_issue', 'get_maintenance_status',
      'create_maintenance_request',
      'generate_statement', 'log_tenant_incident', 'log_payment_promise',
      'send_notification', 'notify_tenant', 'initiate_payment'
    ],
    [UserRole.COMPANY_STAFF]: [
      // Staff can do almost everything
      'list_properties', 'get_property_details', 'get_units', 'get_unit_details',
      'list_units', 'create_property', 'update_property', 'create_unit',
      'update_unit', 'update_unit_status', 'create_lease', 'update_lease',
      'get_portfolio_arrears', 'list_vacant_units',
      'search_tenants', 'list_tenants', 'get_tenant_details', 'get_tenant_arrears',
      'get_tenant_statement',
      'list_payments', 'get_payment_details', 'get_lease_details',
      'get_collection_rate', 'get_occupancy_stats', 'get_maintenance_status',
      'list_maintenance_tickets', 'generate_rent_roll', 'generate_statement',
      'generate_report_file',
      'get_financial_report',
      'get_financial_summary',
      'get_revenue_summary', 'get_monthly_summary', 'generate_monthly_summary',
      'check_payment_status', 'get_payment_status',
      'register_tenant', 'create_tenant', 'bulk_create_tenants', 'import_tenants', 'update_tenant_contact', 'log_maintenance_issue',
      'update_ticket_status', 'process_payment', 'record_payment', 'create_invoice', 'update_invoice',
      'record_expense', 'log_maintenance', 'log_tenant_incident', 'log_payment_promise',
      'send_notification', 'notify_tenant', 'update_maintenance_request',
      'send_rent_reminders', 'send_bulk_reminder', 'bulk_generate_invoices', 'initiate_payment'
    ],
    [UserRole.LANDLORD]: [
      'get_revenue_summary', 'get_collection_rate', 'list_properties',
      'get_property_details', 'get_occupancy_stats', 'generate_rent_roll',
      'get_portfolio_arrears', 'list_vacant_units', 'generate_report_file',
      'get_maintenance_status', 'list_maintenance_tickets'
    ],
    [UserRole.SUPER_ADMIN]: [
      'list_companies', 'search_companies', 'select_company', 'register_company',
      'configure_whatsapp', 'analyze_agent_goal', 'evaluate_agent_progress',
      // Include staff tools as fallback visibility
      'list_properties', 'get_property_details', 'get_units', 'get_unit_details',
      'list_units',
      'search_tenants', 'get_tenant_details', 'get_tenant_arrears',
      'get_tenant_statement',
      'list_payments', 'get_payment_details', 'get_lease_details',
      'get_collection_rate', 'get_occupancy_stats', 'get_maintenance_status',
      'list_maintenance_tickets', 'generate_rent_roll', 'generate_statement',
      'generate_report_file',
      'get_financial_report',
      'get_financial_summary',
      'get_revenue_summary', 'get_monthly_summary', 'generate_monthly_summary',
      'check_payment_status', 'get_payment_status', 'create_staff', 'update_staff_profile'
    ],
    [UserRole.UNIDENTIFIED]: [
      'register_company',
    ],
  };

  async executeTool(
    name: string,
    args: any,
    context: any,
    role: UserRole,
    language: string,
  ): Promise<any> {
    this.logger.log(`Executing tool: ${name} for role: ${role}`);

    // v5.2 Deterministic Safety Net (Allowlist-First)
    if (!this.isToolAllowed(name, role)) {
      this.logger.error(`[Security] Tool ${name} is NOT permitted for role ${role}`);
      throw new Error(`Unauthorized: Tool ${name} is not permitted for your role.`);
    }

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

    // send_notification: alias for a simple log/message action
    if (name === 'send_notification' || name === 'notify_tenant') {
      return await this.writeTools.executeWriteTool('send_notification', args, context, role, language);
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
   * Returns a list of tool names available for a specific user role.
   */
  async getToolsForRole(role: string): Promise<string[]> {
    const r = role.toUpperCase();
    if (r === UserRole.COMPANY_ADMIN) {
      return this.ROLE_TOOL_ALLOWLIST[UserRole.COMPANY_STAFF];
    }
    return this.ROLE_TOOL_ALLOWLIST[r] || [];
  }

  /**
   * Deterministic check if a tool is allowed for a role.
   */
  isToolAllowed(name: string, role: string): boolean {
    const r = role.toUpperCase();
    
    // v5.5 SUPER_ADMIN Security Logic: Global Read, Scoped Write
    if (r === UserRole.SUPER_ADMIN) {
      if (this.isReadTool(name)) return true; // Global Read Visibility
      
      const allowedAdminActions = [
        'register_company', 'process_risk_analysis', 'process_data_sync', 
        'onboard_landlord', 'analyze_agent_goal', 'evaluate_agent_progress'
      ];
      if (allowedAdminActions.includes(name)) return true;
      
      // Fallback: Super Admin can also do anything Staff can do, but it's audited.
      return this.ROLE_TOOL_ALLOWLIST[UserRole.COMPANY_STAFF].includes(name);
    }

    const effectiveRole = r === UserRole.COMPANY_ADMIN ? UserRole.COMPANY_STAFF : r;

    const allowed = this.ROLE_TOOL_ALLOWLIST[effectiveRole] || [];

    // Explicitly allow agent tools for internal workflow if they are part of the system
    const agentTools = ['analyze_agent_goal', 'evaluate_agent_progress', 'process_agent_feedback', 'notify_agent_plan', 'send_agent_heartbeat', 'execute_agent_chunk'];
    if (agentTools.includes(name)) {
      return true;
    }

    return allowed.includes(name);
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

  /**
   * Identifies tools that are considered high-stakes (financial or maintenance mutations).
   */
  isHighStakes(name: string): boolean {
    const highStakesTools = [
      'process_payment',
      'record_expense',
      'log_maintenance_issue',
      'update_ticket_status',
      'update_maintenance_request',
      'get_tenant_arrears',
      'get_revenue_summary',
      'generate_monthly_summary',
      'register_tenant',
      'send_notification',
      'notify_tenant'
    ];
    return highStakesTools.includes(name);
  }

  private isReadTool(name: string): boolean {
    const readPrefixes = ['list_', 'get_', 'search_', 'view_', 'generate_', 'check_'];
    const isRead =
      readPrefixes.some((p) => name.startsWith(p)) ||
      name === 'select_company' ||
      name === 'generate_execution_plan' ||
      name === 'detect_duplicates';

    // Exceptions that start with read prefixes but are mutative/staged/complex reports
    const exceptions = [
      'generate_csv_report',
      'generate_report_file',
      'get_financial_report',
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
