import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { WorkflowHandlers } from '../workflows/workflow.engine';
import { AiToolRegistryService } from './ai-tool-registry.service';
import { AiService } from './ai.service';
import { WorkflowInstance, WorkflowStep } from '../workflows/workflow.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkflowBridgeService implements WorkflowHandlers {
    private readonly logger = new Logger(WorkflowBridgeService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly toolRegistry: AiToolRegistryService,
        @Inject(forwardRef(() => AiService))
        private readonly aiService: AiService,
    ) {}

    async executeRule(stepId: string, context: Record<string, any>): Promise<any> {
        this.logger.log(`Executing RULE step: ${stepId}`);
        
        const args = context.args || {};

        switch (stepId) {
            case 'validate_entities': {
                const { tenantId, propertyId, unitId } = args;
                if (tenantId) {
                    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
                    if (!tenant) return { valid: false, error: `Tenant ${tenantId} not found` };
                }
                if (propertyId) {
                    const property = await this.prisma.property.findUnique({ where: { id: propertyId } });
                    if (!property) return { valid: false, error: `Property ${propertyId} not found` };
                }
                if (unitId) {
                    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
                    if (!unit) return { valid: false, error: `Unit ${unitId} not found` };
                }
                return { valid: true };
            }

            case 'segment_by_history': {
                const { tenantId } = args;
                if (!tenantId) return { segment: 'UNKNOWN' };
                
                const payments = await this.prisma.payment.findMany({
                    where: { lease: { tenantId } },
                    orderBy: { paidAt: 'desc' },
                    take: 5
                });

                if (payments.length === 0) return { segment: 'NEW_TENANT' };
                
                // Simple logic: if they have at least 3 payments, they are a 'GOOD_PAYER' for this demo
                const segment = payments.length >= 3 ? 'GOOD_PAYER' : 'NEEDS_MONITORING';
                return { segment };
            }

            default:
                return { success: true };
        }
    }

    async executeTool(stepId: string, context: Record<string, any>): Promise<any> {
        this.logger.log(`Executing TOOL step: ${stepId}`);
        
        // Map stepId to toolNames if they differ
        const stepToToolMap: Record<string, string> = {
            'receive_report': 'create_maintenance_request',
            'notify_agent': 'send_whatsapp_message',
            'acknowledge_tenant': 'send_whatsapp_message',
            'assign_technician': 'update_maintenance_request',
            'close_ticket': 'update_maintenance_request',
            'rate_resolution': 'send_whatsapp_message',
            'identify_unpaid': 'get_portfolio_arrears',
            'send_reminders': 'send_rent_reminders',
            'reconcile': 'record_payment',
            'generate_report': 'generate_report_file',
            'notify_landlord': 'send_whatsapp_message',
            'create_listing': 'create_on_homeet', // Placeholder for actual tool
            'book_viewing': 'send_whatsapp_message',
            'create_properties': 'create_property',
            'create_units': 'create_unit',
            'create_tenants': 'create_tenant',
            'assign_units': 'create_lease',
            'set_balances': 'record_payment',
            'fetch_financials': 'get_financial_report',
            'fetch_occupancy': 'list_vacant_units',
            'fetch_maintenance': 'list_maintenance_requests',
            'assemble_pdf': 'generate_report_file',
            'deliver_agent': 'send_whatsapp_message',
            'suggest_landlord': 'send_whatsapp_message'
        };

        const toolName = stepToToolMap[stepId] || stepId;
        return this.toolRegistry.executeTool(toolName, context.args || {}, context, context.role, context.language || 'en');
    }

    async executeAI(stepId: string, context: Record<string, any>): Promise<any> {
        this.logger.log(`Executing AI step: ${stepId}`);
        // Use AI to extract or process data
        const prompt = `Based on the following context, perform step ${stepId}: ${JSON.stringify(context)}`;
        const result = await this.aiService.chat([], prompt, context.chatId);
        return result.response;
    }

    async onWait(instance: WorkflowInstance, step: WorkflowStep): Promise<void> {
        this.logger.log(`Workflow ${instance.workflowId} waiting at step ${step.id}`);
        // Notify user about the wait if needed
    }
}
