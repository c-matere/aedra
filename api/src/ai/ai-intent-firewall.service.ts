import { Injectable, Logger } from '@nestjs/common';

export interface FirewallResult {
  isIntercepted: boolean;
  intent: string | null;
  message?: string;
  allowedTools?: string[];
  systemConstraint?: string;
  priority?: 'NORMAL' | 'HIGH' | 'EMERGENCY';
}

@Injectable()
export class AiIntentFirewallService {
  private readonly logger = new Logger(AiIntentFirewallService.name);

  /**
   * High-precision regex patterns for deterministic intent locking.
   * Fires BEFORE LLM classification to prevent workflow hallucination.
   */
  private readonly rules = [
    {
      id: 'LATE_PAYMENT',
      intent: 'LATE_PAYMENT',
      patterns: [
        /\bpaid\b.*\balready\b/i,
        /\bsent\b.*\bmoney\b/i,
        /\bpaying\b.*\btomorrow\b/i,
        /\bbalance\b.*\barrears\b/i,
        /\bpromise\b.*\bpay\b/i,
        /\bnimeshalipa\b/i,
        /\bnimeshatuma\b/i,
        /\btayari\b.*\b(pesa|sh|ksh)\b/i,
        /\bbalance\b.*\b(yangu|ni)\b/i,
        /\b(deni|arrears)\b/i,
      ],
      allowedTools: [], // Force natural language acknowledgment only
      systemConstraint: `[LOCKED INTENT: LATE_PAYMENT] You MUST acknowledge the payment/promise first. Do NOT ask for tenant ID or lease ID before acknowledging. Response format: [Acknowledgment] + [Note the amount/date] + [Optional: request for verification].`,
    },
    {
      id: 'WORKFLOW_DEPENDENCY',
      intent: 'WORKFLOW_DEPENDENCY',
      patterns: [
        /\badd\b.*\bwithout\b.*\bplan\b/i,
        /\bregister\b.*\bno\b.*\bsubscription\b/i,
        /\btenant\b.*\bwithout\b.*\bactive\b/i,
        /\beven though\b.*\bno\b.*\bplan\b/i,
        /\bwithout\b.*\bactive\b.*\bplan\b/i,
        /\bno\b.*\bactive\b.*\bplan\b/i,
      ],
      message:
        'I cannot register a tenant or unit without an active billing plan. Please subscribe to a plan in the Dashboard first.',
      isBlocker: true,
    },
    {
      id: 'NOISE_COMPLAINT',
      intent: 'NOISE_COMPLAINT',
      patterns: [
        /\bnoise\b.*\bcomplaint\b/i,
        /\bloud\b.*\bneighbor\b/i,
        /\bparty\b.*\bnext door\b/i,
        /\bplaying\b.*\bloud\b/i,
      ],
      allowedTools: ['log_maintenance_issue'], // Treat as a 'soft' maintenance issue for tracking
    },
  ];

  intercept(message: string, role?: string): FirewallResult {
    const text = (message || '').toLowerCase();
    const effectiveRole = (role || '').toUpperCase();
    const isStaffOrLandlord = [
      'COMPANY_STAFF',
      'STAFF',
      'LANDLORD',
      'SUPER_ADMIN',
      'COMPANY_ADMIN',
    ].includes(effectiveRole);

    for (const rule of this.rules) {
      // Bypass LATE_PAYMENT for staff/landlord
      if (rule.id === 'LATE_PAYMENT' && isStaffOrLandlord) continue;

      for (const pattern of rule.patterns) {
        if (pattern.test(text)) {
          this.logger.log(`[FIREWALL] Intercepted intent: ${rule.id}`);

          if ((rule as any).isBlocker) {
            return {
              isIntercepted: true,
              intent: rule.intent,
              message: (rule as any).message,
            };
          }

          return {
            isIntercepted: true,
            intent: rule.intent,
            allowedTools: rule.allowedTools,
            systemConstraint: (rule as any).systemConstraint,
            priority: (rule as any).priority || 'NORMAL',
          };
        }
      }
    }

    return { isIntercepted: false, intent: null };
  }
}
