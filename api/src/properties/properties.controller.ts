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
import { PropertiesService } from './properties.service';
import type { UpdatePropertyDto } from './properties.service';
import type { RequestWithUser } from '../auth/request-with-user.interface';

@Controller('properties')
@Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.COMPANY_STAFF)
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) { }

  @Get()
  findAll(
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.propertiesService.findAll(
      req.user!,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
      search,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.propertiesService.findOne(id, req.user!);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  create(
    @Body() data: { name: string; address?: string },
    @Req() req: RequestWithUser,
  ) {
    return this.propertiesService.create(data, req.user!);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdatePropertyDto,
    @Req() req: RequestWithUser,
  ) {
    return this.propertiesService.update(id, data, req.user!);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  replace(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdatePropertyDto,
    @Req() req: RequestWithUser,
  ) {
    return this.propertiesService.update(id, data, req.user!);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.propertiesService.remove(id, req.user!);
  }
}
