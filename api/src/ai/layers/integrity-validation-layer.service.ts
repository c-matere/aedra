import { Injectable, Logger } from '@nestjs/common';
import { ExecutionTrace, TruthObject, AiIntent } from '../ai-contracts.types';

@Injectable()
export class IntegrityValidationLayer {
  private readonly logger = new Logger(IntegrityValidationLayer.name);

  /**
   * Final hard gate before rendering.
   * Ensures that the truth object is complete, consistent, and policy-compliant.
   */
  validate(trace: ExecutionTrace): ExecutionTrace {
    this.logger.log(`[Integrity] Validating trace: ${trace.id} (Status: ${trace.status})`);
    
    const { actionContract, steps, truth, workflowState } = trace;

    // 1. Contract Fulfillment & Completion Criteria (Phase 2)
    if (actionContract) {
      const criteria = actionContract.completionCriteria;
      const executedSteps = steps || [];
      const truthData = truth?.data || {};

      // 1a. Mandatory Context (Prerequisites)
      if (actionContract.requiresContext.length > 0) {
        const missingContext = actionContract.requiresContext.filter(c => {
          const val = (workflowState?.data?.[c]) || (truth?.context?.[c]) || (truthData[c]);
          return val === undefined || val === null || val === 'PENDING' || val === '';
        });

        if (missingContext.length > 0) {
          this.logger.error(`[Integrity] Missing required context for ${actionContract.intent}: ${missingContext.join(', ')}`);
          trace.status = (criteria?.allowPartial) ? 'BLOCKED' : 'FAILED';
          trace.errors.push(`Missing required context: ${missingContext.join(', ')}`);
          if (trace.status === 'FAILED') return trace;
        }
      }

      // 1b. Mandatory Tools (Fulfillment)
      if (criteria?.mandatoryTools && criteria.mandatoryTools.length > 0) {
        const failedTools = criteria.mandatoryTools.filter(t => {
          const step = executedSteps.find(s => s.tool === t);
          return !step || !step.success;
        });

        if (failedTools.length > 0) {
          // If we are already BLOCKED, we remain BLOCKED, else FAILED if tools are mandatory
          if (trace.status !== 'BLOCKED') {
            this.logger.error(`[Integrity] Mandatory tools failed/missing: ${failedTools.join(', ')}`);
            trace.status = 'FAILED';
            trace.errors.push(`Mandatory tools failed: ${failedTools.join(', ')}`);
            return trace;
          }
        }
      }

      // 1c. Required Truth Fields (Data Completeness)
      if (criteria?.requiredFields && criteria.requiredFields.length > 0) {
        const missingFields = criteria.requiredFields.filter(f => {
          const val = truthData[f];
          return val === undefined || val === null || val === 'PENDING' || val === '';
        });

        if (missingFields.length > 0 && trace.status !== 'BLOCKED') {
          this.logger.error(`[Integrity] Required fields missing from truth: ${missingFields.join(', ')}`);
          trace.status = 'FAILED';
          trace.errors.push(`Required data fields missing: ${missingFields.join(', ')}`);
          return trace;
        }
      }
    }

    // 2. Truth Consistency & Hallucination Guard
    if (truth) {
      if (truth.status === 'ERROR') {
        trace.status = 'FAILED';
        trace.errors.push('TruthObject reports a functional error.');
        return trace;
      }

      // Hallucination Guard
      const truthValues = JSON.stringify(truth.data).toLowerCase();
      const illegalPatterns = [/pending/, /none/, /null/, /undefined/, /\[object/, /unknown/, /placeholder/];
      if (illegalPatterns.some(p => p.test(truthValues)) && actionContract?.intent !== 'GENERAL_QUERY') {
        this.logger.error(`[Integrity] Hallucination/Incomplete data detected: ${truthValues}`);
        trace.status = 'FAILED';
        trace.errors.push('Incomplete or hallucinated data detected in final state.');
        return trace;
      }

      // Aedra v4.3 Value-Lock Contract: Proposed vs Actual Amount
      const effectiveIntent = actionContract?.intent || trace.interpretation?.intent;
      if (effectiveIntent === AiIntent.PAYMENT_DECLARATION) {
          const truthAmount = truth.data?.amount || truth.data?.payment_amount || 0;
          const proposedAmount = truth.data?.proposedAmount;
          const entityAmount = trace.interpretation?.entities?.amount;

          if ((proposedAmount || entityAmount) && truthAmount === 0) {
              this.logger.error(`[Integrity] Proposed amount ${proposedAmount || entityAmount} not found in verified ledger. Blocking for confirmation.`);
              trace.status = 'BLOCKED';
              trace.errors.push(`Value Verification Required: I see you've mentioned ${proposedAmount || entityAmount}, but I couldn't verify this in our ledger. Did I get the amount right?`);
              return trace;
          }

          // Aedra v4.5 Positive Grounding: Explicit Rejection of Zero-Value Paradox
          // If the user provided a value > 0, we MUST NOT report a 0.00 outcome
          if ((proposedAmount || entityAmount) > 0 && truthAmount === 0) {
              this.logger.error(`[Integrity] Positive Grounding Failure: User claimed ${proposedAmount || entityAmount} but ledger shows 0.00.`);
              trace.status = 'BLOCKED';
              trace.errors.push(`I've noted your amount of ${proposedAmount || entityAmount}. I'm waiting for the system to update our records—I'll confirm once it's reflected in the balance.`);
              return trace;
          }

          if (!truthAmount && !entityAmount) {
              this.logger.error(`[Integrity] PAYMENT_DECLARATION missing amount. Blocking guess.`);
              trace.status = 'BLOCKED';
              trace.errors.push('Payment Amount Required: To record a payment, please specify the exact amount paid.');
              return trace;
          }
      }

      // Zero-Value Hallucination Guard (Mombasa PM-BENCH v5 Fix)
      const financialIntents = ['FINANCIAL_QUERY', 'FINANCIAL_REPORTING', 'record_payment', 'PAYMENT_DECLARATION', 'check_rent_status', 'collection_status'];
      const isFinancial = financialIntents.includes(actionContract?.intent || '') || financialIntents.includes(trace.interpretation?.intent || '');
      
      if (isFinancial && !trace.errors.length) {
          const arrears = truth.data?.recordedArrears;
          const revenue = truth.data?.revenueData || truth.data?.revenue;
          const tenantId = truth.context?.tenantId || trace.interpretation?.entities?.tenantId;
          const hasData = (Array.isArray(revenue) && revenue.length > 0) || (typeof arrears === 'number') || (truth.data?.payments?.length > 0) || (typeof revenue === 'number');
          
          const effectiveIntent = actionContract?.intent || trace.interpretation?.intent;
          const isReporting = effectiveIntent === AiIntent.FINANCIAL_REPORTING;
          if (!hasData || (!tenantId && !isReporting)) {
              this.logger.error(`[Integrity] ${effectiveIntent} blocked. Data missing or Identity not resolved.`);
              trace.status = 'BLOCKED';
              const errorMsg = isReporting 
                ? 'Context Required: Please specify a property or company name to generate the financial report.'
                : 'Identity Required: Please specify the tenant name or unit number to retrieve financial records.';
              trace.errors.push(errorMsg);
              return trace;
          }
      }
    }

    // Capture "RESOLVED" if everything passed and it's not already BLOCKED or FAILED
    if (trace.status === 'PENDING') {
      trace.status = 'RESOLVED';
    }

    return trace;
  }
}
