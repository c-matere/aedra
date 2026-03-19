import { AsyncLocalStorage } from 'async_hooks';
import { UserRole } from '../auth/roles.enum';

export interface TenantContextData {
    userId: string;
    companyId?: string;
    isSuperAdmin: boolean;
    role: UserRole;
    chatId?: string;
}

export const tenantContext = new AsyncLocalStorage<TenantContextData>();
