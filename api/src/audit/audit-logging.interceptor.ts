import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import {
  AuditAction,
  AuditLogService,
  AuditOutcome,
} from './audit-log.service';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';

@Injectable()
export class AuditLoggingInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const response = context.switchToHttp().getResponse<Response>();
    const startedAt = Date.now();

    const requestId = this.resolveRequestId(request);
    const action = this.toAction(request.method);
    const entity = this.toEntity(request.path || request.url);
    const targetId =
      typeof request.params?.id === 'string' ? request.params.id : undefined;

    const writeAudit = (
      outcome: AuditOutcome,
      statusCode: number,
      error?: unknown,
    ) => {
      void this.auditLogService.write({
        action,
        outcome,
        method: request.method,
        path: request.originalUrl ?? request.url,
        entity,
        targetId,
        actorId: request.user?.id,
        actorRole: request.user?.role,
        actorCompanyId: request.user?.companyId,
        statusCode,
        durationMs: Date.now() - startedAt,
        ip: request.ip,
        userAgent: request.get('user-agent'),
        requestId,
        metadata: {
          params: request.params,
          query: request.query,
          body: request.body,
          error: error ? this.toErrorMetadata(error) : undefined,
        },
      });
    };

    return next.handle().pipe(
      tap(() => {
        writeAudit('SUCCESS', response.statusCode || 200);
      }),
      catchError((error) => {
        const statusCode = this.resolveErrorStatus(error);
        writeAudit('FAILURE', statusCode, error);
        return throwError(() => error);
      }),
    );
  }

  private resolveRequestId(request: Request): string {
    const requestIdHeader = request.get('x-request-id');
    if (requestIdHeader && requestIdHeader.trim()) {
      return requestIdHeader.trim();
    }

    return randomUUID();
  }

  private toAction(method: string): AuditAction {
    switch (method.toUpperCase()) {
      case 'POST':
        return 'CREATE';
      case 'PATCH':
      case 'PUT':
        return 'UPDATE';
      case 'DELETE':
        return 'DELETE';
      case 'GET':
      case 'HEAD':
      case 'OPTIONS':
        return 'READ';
      default:
        return 'SYSTEM';
    }
  }

  private toEntity(path: string): string | undefined {
    const segment = path.split('?')[0]?.split('/').filter(Boolean)[0];
    return segment || undefined;
  }

  private resolveErrorStatus(error: unknown): number {
    if (
      typeof error === 'object' &&
      error !== null &&
      'getStatus' in error &&
      typeof (error as { getStatus?: () => number }).getStatus === 'function'
    ) {
      return (error as { getStatus: () => number }).getStatus();
    }

    return 500;
  }

  private toErrorMetadata(error: unknown): Record<string, unknown> {
    if (!(error instanceof Error)) {
      return { message: String(error) };
    }

    return {
      name: error.name,
      message: error.message,
    };
  }
}
