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
import { MaintenanceRequestsService } from './maintenance-requests.service';

@Controller('maintenance-requests')
@Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.COMPANY_STAFF)
export class MaintenanceRequestsController {
  constructor(
    private readonly maintenanceRequestsService: MaintenanceRequestsService,
  ) {}

  @Get()
  findAll(
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.maintenanceRequestsService.findAll(
      req.user!,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
      search,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.maintenanceRequestsService.findOne(id, req.user!);
  }

  @Post()
  create(
    @Body()
    data: {
      title: string;
      description?: string;
      category?: string;
      priority?: string;
      status?: string;
      estimatedCost?: number;
      actualCost?: number;
      vendor?: string;
      vendorPhone?: string;
      notes?: string;
      propertyId: string;
      unitId?: string;
      assignedToId?: string;
      scheduledAt?: string;
      completedAt?: string;
    },
    @Req() req: RequestWithUser,
  ) {
    return this.maintenanceRequestsService.create(data, req.user!);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    data: {
      title?: string;
      description?: string;
      category?: string;
      priority?: string;
      status?: string;
      estimatedCost?: number;
      actualCost?: number;
      vendor?: string;
      vendorPhone?: string;
      notes?: string;
      propertyId?: string;
      unitId?: string;
      assignedToId?: string;
      scheduledAt?: string;
      completedAt?: string;
    },
    @Req() req: RequestWithUser,
  ) {
    return this.maintenanceRequestsService.update(id, data, req.user!);
  }

  @Put(':id')
  replace(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    data: {
      title?: string;
      description?: string;
      category?: string;
      priority?: string;
      status?: string;
      estimatedCost?: number;
      actualCost?: number;
      vendor?: string;
      vendorPhone?: string;
      notes?: string;
      propertyId?: string;
      unitId?: string;
      assignedToId?: string;
      scheduledAt?: string;
      completedAt?: string;
    },
    @Req() req: RequestWithUser,
  ) {
    return this.maintenanceRequestsService.update(id, data, req.user!);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.maintenanceRequestsService.remove(id, req.user!);
  }
}
