import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import type { Response } from 'express';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/roles.enum';
import type { RequestWithUser } from '../auth/request-with-user.interface';
import { DocumentsService } from './documents.service';

@Controller('documents')
@Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.COMPANY_STAFF)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) { }

  @Get()
  findAll(
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.documentsService.findAll(
      req.user!,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
      search,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.documentsService.findOne(id, req.user!);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        },
      }),
    }),
  )
  uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB limit
          new FileTypeValidator({
            fileType:
              /^(image\/(jpeg|png|webp)|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)|application\/vnd\.ms-excel|text\/csv|text\/plain)$/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Req() req: RequestWithUser,
  ) {
    if (!file) {
      throw new Error('No file provided');
    }

    // Return the relative URL of the uploaded file
    return {
      fileUrl: `${process.env.API_URL || 'http://localhost:3001'}/documents/files/${file.filename}`,
    };
  }

  @Get('files/:filename')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.COMPANY_STAFF)
  serveFile(@Param('filename') filename: string, @Res() res: Response) {
    return res.sendFile(filename, { root: join(process.cwd(), 'uploads') });
  }

  @Post()
  create(
    @Body()
    data: {
      name: string;
      fileUrl: string;
      type?: 'AGREEMENT' | 'COMPLIANCE' | 'ID_PROOF' | 'INVOICE_COPY' | 'OTHER';
      description?: string;
      propertyId?: string;
      unitId?: string;
      tenantId?: string;
      leaseId?: string;
    },
    @Req() req: RequestWithUser,
  ) {
    return this.documentsService.create(data, req.user!);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    data: {
      name?: string;
      fileUrl?: string;
      type?: 'AGREEMENT' | 'COMPLIANCE' | 'ID_PROOF' | 'INVOICE_COPY' | 'OTHER';
      description?: string;
      propertyId?: string;
      unitId?: string;
      tenantId?: string;
      leaseId?: string;
    },
    @Req() req: RequestWithUser,
  ) {
    return this.documentsService.update(id, data, req.user!);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.documentsService.remove(id, req.user!);
  }
}
