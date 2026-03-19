import { Logger } from '@nestjs/common';

const logger = new Logger('ConversationStateValidator');

export interface HistoryMessage {
  role: string;
  parts: { text: string }[];
}

export interface ValidationReport {
  valid: boolean;
  repairsMade: number;
  issues: string[];
}

/**
 * Lightweight OO wrapper used by tests and services.
 * Keeps the pure function intact while exposing a simple validate() API.
 */
export class ConversationStateValidator {
  validate(history: any[]) {
    // Normalize legacy `{ content }` shape into parts[]
    const normalized = (history || []).map((h: any) => {
      if (h.parts && Array.isArray(h.parts)) return h as HistoryMessage;
      return {
        role: h.role || 'user',
        parts: [{ text: h.content ?? '' }],
      } as HistoryMessage;
    });

    const { history: repairedHistory, report } = validateAndRepairHistory(normalized as any);
    return {
      ...report,
      repairedHistory,
      repaired: report.repairsMade > 0,
    };
  }
}

/**
 * validateAndRepairHistory
 *
 * Gap 7: Conversation State Validator
 *
 * Runs before every model call to verify and repair conversation history.
 * Prevents corrupted state (dangling tool calls, mismatched turns) from
 * producing silent incorrect model reasoning.
 *
 * Rules enforced:
 * 1. Every `model` turn that contains a functionCall must be followed by a `user` turn with a functionResponse.
 * 2. The first message in history must be from `user`.
 * 3. No two consecutive messages from the same role (except tool turns).
 * 4. No empty `parts` arrays.
 */
export function validateAndRepairHistory(history: HistoryMessage[]): {
  history: HistoryMessage[];
  report: ValidationReport;
} {
  const issues: string[] = [];
  let repairsMade = 0;
  let repaired = [...history];

  // Rule 1: Must start with user turn
  while (repaired.length > 0 && repaired[0].role !== 'user') {
    issues.push(`Removed leading non-user turn (role: ${repaired[0].role})`);
    repaired.shift();
    repairsMade++;
  }

  // Rule 2: Remove turns with empty parts
  const beforeEmpty = repaired.length;
  repaired = repaired.filter(msg => {
    const hasContent = msg.parts && msg.parts.length > 0 && msg.parts.some(p => p.text?.trim());
    return hasContent;
  });
  const removedEmpty = beforeEmpty - repaired.length;
  if (removedEmpty > 0) {
    issues.push(`Removed ${removedEmpty} empty/contentless turns`);
    repairsMade += removedEmpty;
  }

  // Rule 3: Detect dangling model turns with functionCall but no subsequent functionResponse
  const cleaned: HistoryMessage[] = [];
  for (let i = 0; i < repaired.length; i++) {
    const msg = repaired[i];
    const isFunctionCallTurn = msg.role === 'model' && msg.parts.some((p: any) => p.functionCall);
    if (isFunctionCallTurn) {
      const next = repaired[i + 1];
      const nextHasFunctionResponse = next && next.role === 'user' && next.parts.some((p: any) => p.functionResponse);
      if (!nextHasFunctionResponse) {
        issues.push(`Dropped dangling functionCall turn at index ${i} (no matching functionResponse)`);
        repairsMade++;
        // Skip this turn — do not add to cleaned
        continue;
      }
    }
    cleaned.push(msg);
  }
  repaired = cleaned;

  // Rule 4: Detect consecutive same-role turns (non-tool) and insert a synthetic filler
  const normalized: HistoryMessage[] = [];
  for (let i = 0; i < repaired.length; i++) {
    const msg = repaired[i];
    const prev = normalized[normalized.length - 1];
    if (prev && prev.role === msg.role && msg.role !== 'user') {
      // Insert a synthetic user acknowledgement so the model doesn't see two model turns in a row
      issues.push(`Inserted synthetic user turn between consecutive ${msg.role} turns at index ${i}`);
      normalized.push({ role: 'user', parts: [{ text: '...' }] });
      repairsMade++;
    }
    normalized.push(msg);
  }

  if (repairsMade > 0) {
    logger.warn(`[StateValidator] History repaired: ${repairsMade} fix(es). Issues: ${issues.join(' | ')}`);
  } else {
    logger.verbose(`[StateValidator] History valid. ${normalized.length} turns.`);
  }

  return {
    history: normalized,
    report: {
      valid: repairsMade === 0,
      repairsMade,
      issues,
    },
  };
}
