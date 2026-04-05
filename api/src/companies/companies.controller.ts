import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { CompaniesService } from './companies.service';
import type { UpdateCompanyDto } from './companies.service';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/roles.enum';
import type { RequestWithUser } from '../auth/request-with-user.interface';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  async findAll() {
    return this.companiesService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.COMPANY_STAFF)
  async findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  async update(
    @Param('id') id: string,
    @Body() data: UpdateCompanyDto,
  ) {
    return this.companiesService.update(id, data);
  }

  @Post(':id/test-mpesa')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  async testMpesa(
    @Param('id') id: string,
    @Body() data: UpdateCompanyDto,
  ) {
    return this.companiesService.testMpesa(id, data);
  }

  @Post(':id/test-sms')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  async testSms(
    @Param('id') id: string,
    @Body() data: UpdateCompanyDto,
  ) {
    return this.companiesService.testSms(id, data);
  }

  @Post(':id/test-maps')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  async testMaps(
    @Param('id') id: string,
    @Body() data: UpdateCompanyDto,
  ) {
    return this.companiesService.testMaps(id, data);
  }

  @Post(':id/logo')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req: any, file: any, cb: any) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `company-logo-${uniqueSuffix}${ext}`);
        },
      }),
    }),
  )
  async uploadLogo(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
  ) {
    if (!file || !file.mimetype.startsWith('image/')) {
      throw new BadRequestException(
        `Validation failed (current file type is ${file?.mimetype}, expected type matches image/*)`,
      );
    }
    const logoPath = `/documents/files/${file.filename}`;
    return this.companiesService.update(id, { logo: logoPath });
  }

  @Delete(':id/logo')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  async removeLogo(@Param('id') id: string) {
    return this.companiesService.update(id, { logo: null });
  }
}
