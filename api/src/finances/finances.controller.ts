import { Controller, Get, Post, Body, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { FinancesService } from './finances.service';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/roles.enum';
import type { RequestWithUser } from '../auth/request-with-user.interface';
import { RolesGuard } from '../auth/roles.guard';
import { ExpenseCategory, IncomeCategory } from '@prisma/client';

@Controller('finances')
@UseGuards(RolesGuard)
export class FinancesController {
    constructor(private readonly financesService: FinancesService) { }

    @Get('office/summary')
    @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
    async getSummary(@Req() req: RequestWithUser) {
        if (!req.user?.companyId) {
            throw new BadRequestException('companyId is required for SUPER_ADMIN.');
        }
        return this.financesService.getOfficeSummary(req.user!);
    }

    @Get('office/income')
    @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
    async getIncome(@Req() req: RequestWithUser) {
        if (!req.user?.companyId) {
            throw new BadRequestException('companyId is required for SUPER_ADMIN.');
        }
        return this.financesService.findAllIncome(req.user!);
    }

    @Get('office/expenses')
    @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
    async getExpenses(@Req() req: RequestWithUser) {
        if (!req.user?.companyId) {
            throw new BadRequestException('companyId is required for SUPER_ADMIN.');
        }
        return this.financesService.findAllOfficeExpenses(req.user!);
    }
}

@Controller('finances/office')
@UseGuards(RolesGuard)
export class OfficeFinancesController {
    constructor(private readonly financesService: FinancesService) { }

    @Post('income')
    @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
    async createIncome(
        @Req() req: RequestWithUser,
        @Body() body: {
            amount: number;
            category: IncomeCategory;
            date: string;
            description?: string;
            propertyId?: string;
            companyId?: string;
        }
    ) {
        if (!req.user?.companyId && !body.companyId) {
            throw new BadRequestException('companyId is required for SUPER_ADMIN.');
        }
        return this.financesService.createIncome(req.user!, {
            ...body,
            date: new Date(body.date),
        });
    }

    @Post('expenses')
    @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
    async createExpense(
        @Req() req: RequestWithUser,
        @Body() body: {
            amount: number;
            category: ExpenseCategory;
            date: string;
            description: string;
            vendor?: string;
            reference?: string;
            notes?: string;
            companyId?: string;
        }
    ) {
        if (!req.user?.companyId && !body.companyId) {
            throw new BadRequestException('companyId is required for SUPER_ADMIN.');
        }
        return this.financesService.createOfficeExpense(req.user!, {
            ...body,
            date: new Date(body.date),
        });
    }
}
