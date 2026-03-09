import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AiService } from './ai.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/roles.enum';

@Controller('ai')
@UseGuards(RolesGuard)
export class AiController {
    constructor(private readonly aiService: AiService) { }

    @Post('chat')
    @Roles(UserRole.COMPANY_ADMIN, UserRole.COMPANY_STAFF, UserRole.SUPER_ADMIN)
    async chat(@Body() body: { history: any[]; message: string }) {
        const response = await this.aiService.chat(body.history, body.message);
        return { response };
    }

    @Post('workflows/active')
    @Roles(UserRole.COMPANY_ADMIN, UserRole.COMPANY_STAFF, UserRole.SUPER_ADMIN)
    async listWorkflows() {
        return await this.aiService.listActiveWorkflows();
    }
}
