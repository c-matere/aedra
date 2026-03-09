import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContextData {
    userId: string;
    companyId?: string;
    isSuperAdmin: boolean;
}

export const tenantContext = new AsyncLocalStorage<TenantContextData>();
