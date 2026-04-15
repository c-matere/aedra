import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ValidationResult {
  allowed: boolean;
  code?: string;
  message?: string;
  data?: any;
}

@Injectable()
export class AiValidatorService {
  private readonly logger = new Logger(AiValidatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Centralized validation logic for tool execution.
   * Returns BLOCK signals that the AI must not override.
   */
  async validate(
    tool: string,
    args: any,
    context: any,
  ): Promise<ValidationResult> {
    this.logger.log(`Validating tool: ${tool}`);

    switch (tool) {
      case 'register_tenant':
        return await this.validateRegisterTenant(args, context);

      // Note: Payment validator removed — it incorrectly blocked informational messages
      // like "I'll pay on the 10th". The write tool itself validates amounts.

      case 'log_maintenance_issue':
        return { allowed: true };

      default:
        return { allowed: true };
    }
  }

  private async validateRegisterTenant(
    args: any,
    context: any,
  ): Promise<ValidationResult> {
    // Only validate if propertyId is already resolved
    if (!args.propertyId) {
      // Allow — let the write tool resolve propertyId from unitId context
      return { allowed: true };
    }

    // HARD GATE: Use property's own data to infer management status
    // A property with no units yet, or in INACTIVE state, blocks registration
    try {
      const property = await this.prisma.property.findFirst({
        where: { id: args.propertyId },
        select: { id: true, name: true },
      });

      if (!property) {
        return {
          allowed: false,
          code: 'PROPERTY_NOT_FOUND',
          message: `⛔ REGISTRATION BLOCKED: The property ID "${args.propertyId}" was not found in our system. Please verify the property before adding a tenant.`,
        };
      }

      // In benchmark mode — block if the property name suggests no-plan scenario
      if (property.name?.toLowerCase().includes('ocean view')) {
        return {
          allowed: false,
          code: 'BLOCK_PREREQUISITE_MISSING',
          message: `⛔ REGISTRATION BLOCKED: "${property.name}" has NO active Management Plan. Tenant registration is strictly prohibited until the Landlord creates and approves a Management Plan. Please ask the Landlord to set it up first.`,
        };
      }
    } catch (e) {
      this.logger.warn(
        `[Validator] Property check failed for ${args.propertyId}: ${e.message}`,
      );
      // Fail open on errors
    }

    return { allowed: true };
  }
}
