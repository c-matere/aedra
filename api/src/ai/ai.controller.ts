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
    async chat(@Body() body: { history: any[]; message: string; chatId?: string; companyId?: string; companyName?: string; attachments?: any[] }) {
        return await this.aiService.chat(body.history, body.message, body.chatId, body.companyId, body.companyName, body.attachments);
    }

    @Post('chat/sessions')
    @Roles(UserRole.COMPANY_ADMIN, UserRole.COMPANY_STAFF, UserRole.SUPER_ADMIN)
    async listSessions(@Req() req: any) {
        return await this.aiService.getChatSessions(req.user.id);
    }

    @Post('chat/sessions/:id')
    @Roles(UserRole.COMPANY_ADMIN, UserRole.COMPANY_STAFF, UserRole.SUPER_ADMIN)
    async getSession(@Req() req: any) {
        return await this.aiService.getChatHistory(req.params.id);
    }

    @Post('chat/sessions/:id/delete')
    @Roles(UserRole.COMPANY_ADMIN, UserRole.COMPANY_STAFF, UserRole.SUPER_ADMIN)
    async deleteSession(@Req() req: any) {
        return await this.aiService.deleteChatSession(req.params.id);
    }

    @Post('workflows/active')
    @Roles(UserRole.COMPANY_ADMIN, UserRole.COMPANY_STAFF, UserRole.SUPER_ADMIN)
    async listWorkflows() {
        return await this.aiService.listActiveWorkflows();
    }
}
