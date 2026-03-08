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
import { PaymentsService } from './payments.service';

@Controller('payments')
@Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.COMPANY_STAFF)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  findAll(
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.paymentsService.findAll(
      req.user!,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
      search,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.paymentsService.findOne(id, req.user!);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  create(
    @Body()
    data: {
      amount: number;
      leaseId: string;
      paidAt?: string;
      method?: string;
      type?: string;
      reference?: string;
      notes?: string;
    },
    @Req() req: RequestWithUser,
  ) {
    return this.paymentsService.create(data, req.user!);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    data: {
      amount?: number;
      leaseId?: string;
      paidAt?: string;
      method?: string;
      type?: string;
      reference?: string;
      notes?: string;
    },
    @Req() req: RequestWithUser,
  ) {
    return this.paymentsService.update(id, data, req.user!);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  replace(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    data: {
      amount?: number;
      leaseId?: string;
      paidAt?: string;
      method?: string;
      type?: string;
      reference?: string;
      notes?: string;
    },
    @Req() req: RequestWithUser,
  ) {
    return this.paymentsService.update(id, data, req.user!);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.paymentsService.remove(id, req.user!);
  }
}
