import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  TenantsService,
  type CreateTenantDto,
  type UpdateTenantDto,
} from './tenants.service';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/roles.enum';
import type { RequestWithUser } from '../auth/request-with-user.interface';

@Controller('tenants')
@Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  findAll(
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.tenantsService.findAll(
      req.user!,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
      search,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.tenantsService.findOne(id, req.user!);
  }

  @Post()
  create(@Body() data: CreateTenantDto, @Req() req: RequestWithUser) {
    return this.tenantsService.create(data, req.user!);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateTenantDto,
    @Req() req: RequestWithUser,
  ) {
    return this.tenantsService.update(id, data, req.user!);
  }

  @Put(':id')
  replace(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateTenantDto,
    @Req() req: RequestWithUser,
  ) {
    return this.tenantsService.update(id, data, req.user!);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.tenantsService.remove(id, req.user!);
  }
}
