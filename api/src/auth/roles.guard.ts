import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestWithUser } from './request-with-user.interface';
import { ROLES_KEY } from './roles.decorator';
import { UserRole } from './roles.enum';
import { verifySessionToken } from './session-token';

const VALID_ROLES = new Set<string>(Object.values(UserRole));

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = this.resolveUser(request);

    if (!user) {
      throw new UnauthorizedException(
        'Missing user context. Provide a valid Bearer session token.',
      );
    }

    request.user = user;

    // SUPER_ADMIN is always allowed to simplify platform-level support access.
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        'You do not have permission to access this resource.',
      );
    }

    return true;
  }

  private resolveUser(request: RequestWithUser): RequestWithUser['user'] {
    if (request.user) {
      return request.user;
    }

    const authHeader = request.header('authorization');
    if (!authHeader?.toLowerCase().startsWith('bearer ')) {
      return undefined;
    }

    const token = authHeader.slice('bearer '.length).trim();
    const session = verifySessionToken(token);

    if (!session || !VALID_ROLES.has(session.role)) {
      return undefined;
    }

    return {
      id: session.userId,
      companyId: session.companyId,
      role: session.role as UserRole,
    };
  }
}
