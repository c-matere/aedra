import { Controller, Get, Req, Param } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/roles.enum';
import type { RequestWithUser } from '../auth/request-with-user.interface';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

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

  @Get(':id/data')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  async getPortfolioData(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    return this.reportsService.getPortfolioData(id, req.user!);
  }
}
