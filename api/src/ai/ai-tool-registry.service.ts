import { Injectable, Logger } from '@nestjs/common';
import { UserRole } from '../auth/roles.enum';
import { AiReadToolService } from './ai-read-tool.service';
import { AiWriteToolService } from './ai-write-tool.service';
import { AiReportToolService } from './ai-report-tool.service';

@Injectable()
export class AiToolRegistryService {
    private readonly logger = new Logger(AiToolRegistryService.name);

    constructor(
        private readonly readTools: AiReadToolService,
        private readonly writeTools: AiWriteToolService,
        private readonly reportTools: AiReportToolService,
    ) {}

    async executeTool(name: string, args: any, context: any, role: UserRole, language: string): Promise<any> {
        this.logger.log(`Executing tool: ${name}`);

        // Routing logic based on tool categories
        if (this.isReadTool(name)) {
            return await this.readTools.executeReadTool(name, args, context, role, language);
        }

        if (name.includes('_report') || name.includes('_staged') || name === 'register_company' || name === 'process_risk_analysis') {
            return await this.reportTools.executeReportTool(name, args, context, role, language);
        }

        // Default to write tools for everything else (mutative)
        return await this.writeTools.executeWriteTool(name, args, context, role, language);
    }

    private isReadTool(name: string): boolean {
        const readPrefixes = ['list_', 'get_', 'search_', 'view_'];
        const isRead = readPrefixes.some(p => name.startsWith(p)) || name === 'select_company' || name === 'generate_execution_plan';
        
        // Exceptions that start with read prefixes but are mutative/staged
        const exceptions = ['list_tenants_staged', 'list_payments_staged', 'list_invoices_staged'];
        if (exceptions.includes(name)) return false;
        
        return isRead;
    }
}
