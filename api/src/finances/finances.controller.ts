import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { FinancesService } from './finances.service';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/roles.enum';
import type { RequestWithUser } from '../auth/request-with-user.interface';
import { RolesGuard } from '../auth/roles.guard';

@Controller('finances')
@UseGuards(RolesGuard)
export class FinancesController {
    constructor(private readonly financesService: FinancesService) { }

    @Get('office/summary')
    @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
    async getSummary(@Req() req: RequestWithUser) {
        return this.financesService.getOfficeSummary(req.user!);
    }

    @Get('office/income')
    @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
    async getIncome(@Req() req: RequestWithUser) {
        return this.financesService.findAllIncome(req.user!);
    }

    @Get('office/expenses')
    @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
    async getExpenses(@Req() req: RequestWithUser) {
        return this.financesService.findAllOfficeExpenses(req.user!);
    }
}
