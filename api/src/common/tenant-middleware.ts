import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { verifySessionToken } from '../auth/session-token';
import { tenantContext } from './tenant-context';
import { UserRole } from '../auth/roles.enum';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        const authHeader = req.header('authorization');
        if (!authHeader?.toLowerCase().startsWith('bearer ')) {
            return next();
        }

        const token = authHeader.slice('bearer '.length).trim();
        const session = verifySessionToken(token);

        if (!session) {
            return next();
        }

        const data = {
            userId: session.userId,
            companyId: session.companyId,
            isSuperAdmin: session.role === UserRole.SUPER_ADMIN,
            role: session.role as UserRole,
        };

        tenantContext.run(data, () => {
            next();
        });
    }
}
