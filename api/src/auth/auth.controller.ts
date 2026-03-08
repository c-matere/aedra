import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Roles } from './roles.decorator';
import { UserRole } from './roles.enum';
import type { RequestWithUser } from './request-with-user.interface';

interface LoginBody {
  email?: string;
  password?: string;
}

interface RegisterCompanyBody {
  companyName: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: LoginBody) {
    const email = body.email?.trim();
    const password = body.password;

    if (!email || !password) {
      throw new BadRequestException('Email and password are required.');
    }

    return this.authService.login(email, password);
  }

  @Post('register-company')
  async registerCompany(@Body() body: RegisterCompanyBody) {
    if (
      !body.companyName ||
      !body.email ||
      !body.password ||
      !body.firstName ||
      !body.lastName
    ) {
      throw new BadRequestException('All fields are required.');
    }

    return this.authService.registerCompany(body);
  }

  @Get('session')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.COMPANY_STAFF)
  session(@Req() req: RequestWithUser) {
    return {
      user: req.user,
    };
  }
}
