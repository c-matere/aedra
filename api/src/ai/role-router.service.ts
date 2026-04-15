import { Injectable, Logger } from '@nestjs/common';
import { AiStrategy } from './ai-strategies.types';
import { TenantIntentStrategy } from './strategies/tenant-intent.strategy';
import { StaffIntentStrategy } from './strategies/staff-intent.strategy';
import { LandlordIntentStrategy } from './strategies/landlord-intent.strategy';

@Injectable()
export class RoleRouter {
  private readonly logger = new Logger(RoleRouter.name);

  constructor(
    private readonly tenantStrategy: TenantIntentStrategy,
    private readonly staffStrategy: StaffIntentStrategy,
    private readonly landlordStrategy: LandlordIntentStrategy,
  ) {}

  getStrategy(role: string): AiStrategy {
    const r = role.toUpperCase();
    this.logger.log(`[RoleRouter] Selecting strategy for role: ${r}`);

    if (r === 'TENANT') return this.tenantStrategy;
    if (
      r === 'COMPANY_STAFF' ||
      r === 'STAFF' ||
      r === 'SUPER_ADMIN' ||
      r === 'ADMIN' ||
      r === 'MANAGER'
    ) {
      return this.staffStrategy;
    }
    if (r === 'LANDLORD' || r === 'OWNER') return this.landlordStrategy;

    this.logger.warn(
      `[RoleRouter] Unknown role: ${role}. defaulting to TenantStrategy for safety.`,
    );
    return this.tenantStrategy;
  }
}
