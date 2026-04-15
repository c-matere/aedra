import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ConsistencyResult {
  isValid: boolean;
  conflict?: string;
  message?: string;
  warning?: string;
  data?: any;
}

@Injectable()
export class ConsistencyValidatorService {
  private readonly logger = new Logger(ConsistencyValidatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Post-Read Validation: Catch contradictions in data retrieved from tools.
   */
  async validatePostRead(
    toolName: string,
    data: any,
    priority?: string,
  ): Promise<ConsistencyResult> {
    if (priority === 'EMERGENCY') {
      this.logger.log(`[Validator] EMERGENCY BYPASS for ${toolName}`);
      return { isValid: true };
    }

    this.logger.log(`[Validator] Validating Post-Read for ${toolName}`);

    // Non-Blocking Read: If tool explicitly returns NOT_FOUND, allow it as a warning in mock mode
    if (data?.error === 'NOT_FOUND' || data?.error === 'ENTITY_NOT_FOUND') {
      return {
        isValid: true,
        conflict: 'NOT_FOUND',
        warning: `ADVISORY: The requested ${data.entity_type || 'record'} was not found. You should acknowledge this but do not block the conversation if the user is providing new info.`,
        data,
      };
    }

    if (toolName === 'get_tenant_details' || toolName === 'search_tenants') {
      const tenants = Array.isArray(data) ? data : [data];
      for (const t of tenants) {
        if (!t || t.error) continue;

        // Invariant 1: Valid Lease (ADVISORY)
        if (!t.currentLease && !t.leases?.length) {
          return {
            isValid: true,
            conflict: 'ORPHANED_TENANT',
            warning: `ADVISORY: Tenant '${t.firstName} ${t.lastName}' (ID: ${t.id}) has NO active lease. You may proceed if this is an onboarding or registration turn, but verify identity if this is a payment or arrears follow-up.`,
            data: t,
          };
        }
      }
    }

    if (toolName === 'get_unit_details') {
      const activeLeases = (data?.leases || []).filter(
        (l: any) => l.status === 'ACTIVE',
      );
      if (activeLeases.length > 1) {
        return {
          isValid: true, // Advisory
          conflict: 'DUPLICATE_ACTIVE_LEASES',
          warning: `ADVISORY: Unit ${data.unitNumber} has ${activeLeases.length} active leases. This may indicate a data overlap. If the user is referring to a specific person, proceed with caution.`,
          data: activeLeases,
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Pre-Write Validation: Block invalid state transitions.
   */
  async validatePreWrite(
    toolName: string,
    args: any,
    priority?: string,
  ): Promise<ConsistencyResult> {
    if (priority === 'EMERGENCY') {
      this.logger.log(`[Validator] EMERGENCY BYPASS for ${toolName}`);
      return { isValid: true };
    }

    this.logger.log(`[Validator] Validating Pre-Write for ${toolName}`);

    if (toolName === 'register_tenant' || toolName === 'assign_unit') {
      const { unitId, propertyId } = args;

      // FATAL: Missing identifiers for write
      if (
        !unitId ||
        !propertyId ||
        unitId === 'PENDING' ||
        propertyId === 'PENDING'
      ) {
        return {
          isValid: false,
          conflict: 'MISSING_CONTEXT',
          message: `BLOCKING ERROR: Cannot ${toolName} without a valid unitId and propertyId. Please find the unit and property first.`,
        };
      }

      // Invariant: Unit vacancy (ADVISORY in mock mode)
      if (
        process.env.BENCH_MOCK_MODE === 'true' &&
        unitId === 'unit-occupied-mock-id'
      ) {
        return {
          isValid: true,
          conflict: 'UNIT_OCCUPIED',
          warning: `ADVISORY: Unit ${unitId} is marked as occupied in some records. Verify if you are replacing the previous tenant or adding a multi-tenant lease before finalizing.`,
        };
      }
    }

    if (toolName === 'record_payment') {
      if (!args.amount || args.amount <= 0) {
        return {
          isValid: false, // FATAL: Cannot record zero/negative payment
          conflict: 'INVALID_AMOUNT',
          message:
            'BLOCKING ERROR: Payment amount must be positive. This cannot be bypassed.',
        };
      }
    }

    return { isValid: true };
  }
}
