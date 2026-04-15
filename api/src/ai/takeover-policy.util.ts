import type { ActionResult } from './next-step-orchestrator.service';

export type TakeoverReason =
  | 'TOOL_ERROR'
  | 'REQUIRES_CLARIFICATION'
  | 'MISSING_DATA'
  | 'TOO_SIMPLE'
  | 'TRUNCATED'
  | 'UNEXPECTED';

export interface TakeoverEvaluation {
  shouldTakeover: boolean;
  reason?: TakeoverReason;
  details?: string;
}

function hasNonEmptyTotals(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const totals = obj?.totals;
  if (!totals || typeof totals !== 'object') return false;
  return Object.values(totals).some((v) => typeof v === 'number' && v !== 0);
}

/**
 * Evaluates whether we should switch into "LLM takeover" (suggestions-only) mode.
 * This is deliberately conservative: it triggers when the deterministic/menu path
 * is failing, incomplete, truncated, or likely insufficient.
 */
export function evaluateTakeover(
  actionResult: ActionResult | null | undefined,
  options?: { userText?: string; formattedText?: string },
): TakeoverEvaluation {
  const userText = (options?.userText || '').toLowerCase();
  const formattedText = options?.formattedText || '';

  if (!actionResult) {
    return {
      shouldTakeover: true,
      reason: 'UNEXPECTED',
      details: 'Missing action result',
    };
  }

  if (actionResult.success === false) {
    if (actionResult.data?.requires_clarification) {
      return {
        shouldTakeover: true,
        reason: 'REQUIRES_CLARIFICATION',
        details:
          actionResult.data?.message ||
          actionResult.message ||
          'Needs clarification',
      };
    }
    return {
      shouldTakeover: true,
      reason: 'TOOL_ERROR',
      details:
        actionResult.message || actionResult.error || 'Tool reported failure',
    };
  }

  if (actionResult.error) {
    return {
      shouldTakeover: true,
      reason: 'TOOL_ERROR',
      details: String(actionResult.error),
    };
  }

  // Truncation signals (common pattern: tools report caps/limits)
  const data: any = actionResult.data;
  const capped = data?.capped;
  if (capped && typeof capped === 'object') {
    const looksTruncated = Object.values(capped).some(
      (c: any) =>
        c &&
        typeof c === 'object' &&
        typeof c.limit === 'number' &&
        typeof c.returned === 'number' &&
        c.returned >= c.limit,
    );
    if (looksTruncated) {
      return {
        shouldTakeover: true,
        reason: 'TRUNCATED',
        details: 'Tool result was capped/truncated',
      };
    }
  }

  // "Too simple" heuristics for financial reporting:
  // Totals exist but breakdown is empty => user likely expects details.
  if (
    [
      'get_financial_report',
      'get_financial_summary',
      'get_portfolio_arrears',
    ].includes(actionResult.action)
  ) {
    const breakdown = data?.breakdown;
    const breakdownEmpty =
      breakdown &&
      typeof breakdown === 'object' &&
      ['payments', 'expenses', 'invoices', 'arrears'].every(
        (k) => !Array.isArray(breakdown?.[k]) || breakdown?.[k]?.length === 0,
      );
    if (hasNonEmptyTotals(data) && breakdownEmpty) {
      return {
        shouldTakeover: true,
        reason: 'TOO_SIMPLE',
        details: 'Totals present but no breakdown rows',
      };
    }
  }

  // User explicitly asks to retry/resend or indicates mismatch.
  if (
    /\b(retry|resend|send again|not that|wrong|incorrect|im trying|confused|doesn't work)\b/.test(
      userText,
    )
  ) {
    return {
      shouldTakeover: true,
      reason: 'UNEXPECTED',
      details: 'User dissatisfaction signal',
    };
  }

  // If formatter produced a very short output for a complex action, suggest richer options.
  if (
    [
      'get_financial_report',
      'get_financial_summary',
      'get_portfolio_arrears',
    ].includes(actionResult.action) &&
    formattedText.trim().length > 0 &&
    formattedText.trim().length < 120
  ) {
    return {
      shouldTakeover: true,
      reason: 'TOO_SIMPLE',
      details: 'Response looks too brief for report-type action',
    };
  }

  return { shouldTakeover: false };
}
