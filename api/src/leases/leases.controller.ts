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
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/roles.enum';
import type { RequestWithUser } from '../auth/request-with-user.interface';
import { LeasesService } from './leases.service';

@Controller('leases')
@Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.COMPANY_STAFF)
export class LeasesController {
  constructor(private readonly leasesService: LeasesService) { }

  @Get()
  findAll(
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.leasesService.findAll(
      req.user!,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
      search,
      tenantId,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.leasesService.findOne(id, req.user!);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  create(
    @Body()
    data: {
      startDate: string;
      endDate: string;
      rentAmount: number;
      deposit?: number;
      status?: string;
      propertyId: string;
      unitId?: string;
      tenantId: string;
    },
    @Req() req: RequestWithUser,
  ) {
    return this.leasesService.create(data, req.user!);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    data: {
      startDate?: string;
      endDate?: string;
      rentAmount?: number;
      deposit?: number;
      status?: string;
      propertyId?: string;
      unitId?: string;
      tenantId?: string;
    },
    @Req() req: RequestWithUser,
  ) {
    return this.leasesService.update(id, data, req.user!);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  replace(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    data: {
      startDate?: string;
      endDate?: string;
      rentAmount?: number;
      deposit?: number;
      status?: string;
      propertyId?: string;
      unitId?: string;
      tenantId?: string;
    },
    @Req() req: RequestWithUser,
  ) {
    return this.leasesService.update(id, data, req.user!);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.leasesService.remove(id, req.user!);
  }
}
