import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tenantContext } from '../tenant-context';
import { UserRole } from '../../auth/roles.enum';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const store = tenantContext.getStore();

    if (!store) {
      return next.handle();
    }

    if (store.role === UserRole.SUPER_ADMIN) {
      return next.handle();
    }

    const bodyCompanyId = request.body?.companyId;
    const queryCompanyId = request.query?.companyId;
    const paramsCompanyId = request.params?.companyId;

    const providedCompanyId = bodyCompanyId || queryCompanyId || paramsCompanyId;

    if (providedCompanyId && providedCompanyId !== store.companyId) {
      throw new ForbiddenException(
        `Cross-tenant access denied. Your session is restricted to company ${store.companyId}, but you requested ${providedCompanyId}.`,
      );
    }

    // Auto-inject companyId into body if missing (for POST/PATCH)
    if (['POST', 'PATCH', 'PUT'].includes(request.method)) {
      if (!request.body) {
        request.body = {};
      }
      if (!request.body.companyId) {
        request.body.companyId = store.companyId;
      }
    }

    return next.handle();
  }
}
