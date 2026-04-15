import { Controller, Get, Post, Req, Param, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/roles.enum';
import type { RequestWithUser } from '../auth/request-with-user.interface';

import { AiReportToolService } from '../ai/ai-report-tool.service';
import { ReportsGeneratorService } from './reports-generator.service';

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly aiReportTool: AiReportToolService,
    private readonly reportsGenerator: ReportsGeneratorService,
  ) {}

  @Get('summary')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  async getSummary(@Req() req: RequestWithUser) {
    return this.reportsService.getSummary(req.user!);
  }

  @Get('occupancy')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  async getOccupancy(@Req() req: RequestWithUser) {
    return this.reportsService.getOccupancy(req.user!);
  }

  @Get('revenue')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  async getRevenue(@Req() req: RequestWithUser) {
    return this.reportsService.getRevenue(req.user!);
  }

  @Get('leases/:id/statement')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  async getTenantStatement(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportsService.getTenantStatement(
      id,
      req.user!,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('leases/:id/statement/pdf')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  async getTenantStatementPdf(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const data = await this.reportsService.getTenantStatement(
      id,
      req.user!,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );

    const sanitizedFirstName = data.tenant.firstName.replace(
      /[^a-z0-9]/gi,
      '_',
    );
    const sanitizedLastName = data.tenant.lastName.replace(/[^a-z0-9]/gi, '_');
    const fileName = `statement_${sanitizedFirstName}_${sanitizedLastName}_${new Date().toISOString().split('T')[0]}.pdf`;
    const url = await this.reportsGenerator.generateTenantStatementPdf(
      data,
      fileName,
    );
    return { url };
  }

  @Get(':id/data')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  async getPortfolioData(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.reportsService.getPortfolioData(id, req.user!);
  }

  @Post(':id/mckinsey')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  async getMcKinseyReport(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    const result = await this.aiReportTool.executeReportTool(
      'get_mckinsey_style_report',
      { propertyId: id },
      req.user!,
      req.user!.role,
      'en',
    );

    if (result.error) {
      throw new Error(result.message || result.error);
    }

    return result;
  }
}
