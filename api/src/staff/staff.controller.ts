import { Controller, Get, Post, Delete, Body, Param, Req } from '@nestjs/common';
import { StaffService, PropertyAssignmentDto } from './staff.service';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/roles.enum';
import type { RequestWithUser } from '../auth/request-with-user.interface';

@Controller('staff')
@Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get(':userId/assignments')
  async getAssignments(@Param('userId') userId: string, @Req() req: RequestWithUser) {
    return this.staffService.getAssignments(userId, req.user!);
  }

  @Post('assign')
  async assignProperty(@Body() data: PropertyAssignmentDto, @Req() req: RequestWithUser) {
    return this.staffService.assignProperty(data, req.user!);
  }

  @Delete('unassign')
  async unassignProperty(@Body() data: PropertyAssignmentDto, @Req() req: RequestWithUser) {
    return this.staffService.unassignProperty(data, req.user!);
  }

  @Post(':userId/assignments/bulk')
  async setBulkAssignments(
    @Param('userId') userId: string,
    @Body() data: { propertyIds: string[] },
    @Req() req: RequestWithUser,
  ) {
    return this.staffService.setBulkAssignments(userId, data.propertyIds, req.user!);
  }
}
