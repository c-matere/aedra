import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  Query,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto, UpdateInvoiceDto } from './dto/invoice.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/roles.enum';
import type { RequestWithUser } from '../auth/request-with-user.interface';
import { ReportsGeneratorService } from '../reports/reports-generator.service';

@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly reportsGenerator: ReportsGeneratorService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.COMPANY_STAFF)
  create(
    @Body() createInvoiceDto: CreateInvoiceDto,
    @Req() req: RequestWithUser,
  ) {
    return this.invoicesService.create(createInvoiceDto, req.user!);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.COMPANY_STAFF)
  findAll(
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.invoicesService.findAll(
      req.user!,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
      search,
    );
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.COMPANY_STAFF)
  findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.invoicesService.findOne(id, req.user!);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.COMPANY_STAFF)
  update(
    @Param('id') id: string,
    @Body() updateInvoiceDto: UpdateInvoiceDto,
    @Req() req: RequestWithUser,
  ) {
    return this.invoicesService.update(id, updateInvoiceDto, req.user!);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.COMPANY_STAFF)
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.invoicesService.remove(id, req.user!);
  }

  @Get(':id/pdf')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.COMPANY_STAFF)
  async downloadPdf(@Param('id') id: string, @Req() req: RequestWithUser) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        lease: {
          include: {
            tenant: true,
            property: true,
            unit: true,
          },
        },
      },
    });

    if (!invoice) throw new Error('Invoice not found');

    const company = await this.prisma.company.findUnique({
      where: { id: invoice.lease.tenant.companyId },
    });

    const fileName = `invoice_${id.slice(0, 8)}.pdf`;
    const url = await this.reportsGenerator.generateInvoicePdf(
      invoice,
      company,
      fileName,
    );

    return { url };
  }

  @Post('bulk-generate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  async bulkGenerate(
    @Req() req: RequestWithUser,
    @Body('propertyId') propertyId?: string,
  ) {
    return this.invoicesService.generateMonthlyInvoices(req.user!, propertyId);
  }

  @Post('reconcile/:propertyId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  async autoReconcile(
    @Param('propertyId') propertyId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.invoicesService.autoReconcileIncome(req.user!, propertyId);
  }
}
