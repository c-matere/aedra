import { Injectable, Logger } from '@nestjs/common';
import { Interpretation, ActionContract, AiIntent, OperationalIntent, ExecutionTrace } from '../ai-contracts.types';
import { UserRole } from '../../auth/roles.enum';

@Injectable()
export class PolicyLayer {
  private readonly logger = new Logger(PolicyLayer.name);

  enforce(trace: ExecutionTrace): ExecutionTrace {
    const { interpretation, actionContract, role } = trace;

    if (!interpretation || !actionContract) {
      this.logger.error(`[Policy] Missing interpretation or contract in trace: ${trace.id}`);
      trace.status = 'FAILED';
      trace.errors.push('Missing interpretation or contract for policy enforcement.');
      return trace;
    }

    this.logger.log(`[Policy] Enforcing laws for intent: ${interpretation.intent} (Role: ${role})`);
    trace.status = 'POLICY_GATE';

    const laws: string[] = [];
    const forbidden: string[] = [...(actionContract.forbiddenActions || [])];

    // 1. Privacy Law: Never leak neighbor data
    if (interpretation.intent === AiIntent.TENANT_COMPLAINT || interpretation.intent === AiIntent.DISPUTE) {
      laws.push('PRIVACY_SHIELD_ACTIVE');
      forbidden.push('search_tenants', 'get_tenant_details', 'get_unit_details');
    }

    // 2. Safety Law: Burst pipes / Fire are ALWAYS CRITICAL
    const isEmergencyKeywords = interpretation.raw_reasoning?.toLowerCase().match(/\b(fire|flood|burst|moto|imepasuka)\b/);
    if (isEmergencyKeywords || interpretation.intent === AiIntent.EMERGENCY) {
      laws.push('MAX_URGENCY_ELEVATION');
      actionContract.actionPriority = 'IMMEDIATE';
      interpretation.priority = 'EMERGENCY';
      actionContract.elevationRequired = true;
    }

    // 3. Role-Based Access Law (RBAC)
    if (role === UserRole.TENANT) {
      // Tenants can never see portfolio-wide data
      if (actionContract.requiredTools.some(t => ['get_revenue_summary', 'get_collection_rate', 'list_properties'].includes(t))) {
         this.logger.warn(`[Policy] RBAC VIOLATION: Tenant attempted to access restricted tools.`);
         laws.push('RBAC_TRIPWIRE_TRIGGERED');
         actionContract.requiredTools = []; // Strip dangerous tools
         actionContract.type = OperationalIntent.TECHNICAL_APOLOGY;
      }
    }

    this.logger.log(`[Policy] Laws applied: ${laws.join(', ') || 'NONE'}`);
    
    actionContract.forbiddenActions = Array.from(new Set(forbidden));
    trace.metadata.lawsApplied = laws;
    
    return trace;
  }
}
