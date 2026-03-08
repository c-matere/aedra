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
  BadRequestException,
} from '@nestjs/common';
import {
  UsersService,
  type CreateUserDto,
  type UpdateUserDto,
} from './users.service';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/roles.enum';
import type { RequestWithUser } from '../auth/request-with-user.interface';

@Controller('users')
@Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Get()
  findAll(
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAll(
      req.user!,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
      search,
    );
  }

  @Get('invitations')
  findInvitations(@Req() req: RequestWithUser) {
    return this.usersService.findAllInvitations(req.user!);
  }

  @Get(':id')
  findOne(@Req() req: RequestWithUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(req.user!, id);
  }

  @Post()
  create(@Req() req: RequestWithUser, @Body() data: CreateUserDto) {
    return this.usersService.create(req.user!, data);
  }

  @Patch(':id')
  update(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateUserDto,
  ) {
    return this.usersService.update(req.user!, id, data);
  }

  @Put(':id')
  replace(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateUserDto,
  ) {
    return this.usersService.update(req.user!, id, data);
  }

  @Delete(':id')
  remove(@Req() req: RequestWithUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(req.user!, id);
  }

  @Post('invite')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  async createInvitation(
    @Req() req: RequestWithUser,
    @Body() data: { email: string; role: UserRole; firstName?: string; lastName?: string },
  ) {
    if (!data.email || !data.role) {
      throw new BadRequestException('Email and role are required.');
    }
    return this.usersService.createInvitation(req.user!, data);
  }

  @Get('invite/verify/:token')
  @Roles()
  async verifyInvitation(@Param('token') token: string) {
    return this.usersService.verifyInvitation(token);
  }

  @Post('invite/accept/:token')
  @Roles()
  async acceptInvitation(
    @Param('token') token: string,
    @Body() data: { firstName: string; lastName: string; password: string },
  ) {
    if (!data.firstName || !data.lastName || !data.password) {
      throw new BadRequestException('All fields are required.');
    }
    return this.usersService.acceptInvitation(token, data);
  }
}
