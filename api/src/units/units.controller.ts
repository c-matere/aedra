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
import { UnitsService } from './units.service';
import { UnitStatus } from '@prisma/client';

@Controller('units')
@Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.COMPANY_STAFF)
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) { }

  @Get()
  findAll(
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.unitsService.findAll(
      req.user!,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
      search,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.unitsService.findOne(id, req.user!);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  create(
    @Body()
    data: {
      unitNumber: string;
      floor?: string;
      bedrooms?: number;
      bathrooms?: number;
      sizeSqm?: number;
      rentAmount?: number;
      propertyId: string;
      status?: UnitStatus;
    },
    @Req() req: RequestWithUser,
  ) {
    return this.unitsService.create(data, req.user!);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    data: {
      unitNumber?: string;
      floor?: string;
      bedrooms?: number;
      bathrooms?: number;
      sizeSqm?: number;
      rentAmount?: number;
      propertyId?: string;
      status?: UnitStatus;
    },
    @Req() req: RequestWithUser,
  ) {
    return this.unitsService.update(id, data, req.user!);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  replace(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    data: {
      unitNumber?: string;
      floor?: string;
      bedrooms?: number;
      bathrooms?: number;
      sizeSqm?: number;
      rentAmount?: number;
      propertyId?: string;
      status?: UnitStatus;
    },
    @Req() req: RequestWithUser,
  ) {
    return this.unitsService.update(id, data, req.user!);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.unitsService.remove(id, req.user!);
  }
}
