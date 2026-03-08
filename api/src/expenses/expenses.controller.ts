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
  Req,
  Query,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/roles.enum';
import type { RequestWithUser } from '../auth/request-with-user.interface';
import { ExpensesService } from './expenses.service';

@Controller('expenses')
@Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) { }

  @Get()
  findAll(
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.expensesService.findAll(
      req.user!,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
      search,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.expensesService.findOne(id, req.user!);
  }

  @Post()
  create(
    @Body()
    data: {
      description: string;
      amount: number;
      category?: string;
      vendor?: string;
      reference?: string;
      notes?: string;
      propertyId?: string;
      unitId?: string;
    },
    @Req() req: RequestWithUser,
  ) {
    return this.expensesService.create(data, req.user!);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    data: {
      description?: string;
      amount?: number;
      category?: string;
      vendor?: string;
      reference?: string;
      notes?: string;
      propertyId?: string;
      unitId?: string;
    },
    @Req() req: RequestWithUser,
  ) {
    return this.expensesService.update(id, data, req.user!);
  }

  @Put(':id')
  replace(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    data: {
      description?: string;
      amount?: number;
      category?: string;
      vendor?: string;
      reference?: string;
      notes?: string;
      propertyId?: string;
      unitId?: string;
    },
    @Req() req: RequestWithUser,
  ) {
    return this.expensesService.update(id, data, req.user!);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.expensesService.remove(id, req.user!);
  }
}
