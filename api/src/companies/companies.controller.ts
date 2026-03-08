import { Controller, Get, Patch, Body, Param, Req } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import type { UpdateCompanyDto } from './companies.service';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/roles.enum';
import type { RequestWithUser } from '../auth/request-with-user.interface';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.COMPANY_STAFF)
  async findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.companiesService.findOne(id, req.user!);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  async update(
    @Param('id') id: string,
    @Body() data: UpdateCompanyDto,
    @Req() req: RequestWithUser,
  ) {
    return this.companiesService.update(id, data, req.user!);
  }
}
