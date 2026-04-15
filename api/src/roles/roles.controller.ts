import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
} from '@nestjs/common';
import * as RolesSvc from './roles.service';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/roles.enum';
import type { RequestWithUser } from '../auth/request-with-user.interface';

@Controller('roles')
@Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
export class RolesController {
  constructor(private readonly rolesService: RolesSvc.RolesService) {}

  @Get()
  async findAll(@Req() req: RequestWithUser) {
    return this.rolesService.findAll(req.user!);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.rolesService.findOne(id, req.user!);
  }

  @Post()
  async create(
    @Body() data: RolesSvc.CreateRoleDto,
    @Req() req: RequestWithUser,
  ) {
    return this.rolesService.create(data, req.user!);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() data: RolesSvc.UpdateRoleDto,
    @Req() req: RequestWithUser,
  ) {
    return this.rolesService.update(id, data, req.user!);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.rolesService.remove(id, req.user!);
  }
}
