export type ToolErrorNormalization = {
  error: string;
  requires_clarification?: boolean;
  options?: any;
};

export type ToolStringNormalization =
  | {
      isBlocked: true;
      error: string;
      message: string;
      requires_clarification: true;
    }
  | {
      isBlocked: false;
    };

export function normalizeToolErrorShape(raw: any): ToolErrorNormalization {
  const error = typeof raw?.error === 'string' ? raw.error : 'TOOL_ERROR';
  const requiredAction = raw?.required_action;
  const requires_clarification =
    !!requiredAction ||
    [
      'BLOCK_PREREQUISITE_MISSING',
      'AMBIGUOUS_MATCH',
      'ENTITY_NOT_FOUND',
      'NOT_FOUND',
      'VALIDATION_ERROR',
      'CLARIFY_IDENTITY',
      'SELECT_FROM_LIST',
      'CONTEXT_CONFLICT',
      'UNAUTHORIZED',
    ].includes(error);

  const options = raw?.options ?? raw?.matches ?? raw?.candidates;

  return {
    error,
    requires_clarification: requires_clarification ? true : undefined,
    options,
  };
}

export function normalizeToolStringShape(raw: string): ToolStringNormalization {
  const text = (raw ?? '').toString().trim();
  if (!text) return { isBlocked: false };

  // Some tools historically return "error strings" instead of structured objects.
  // Normalize known "blocked" prefixes so the UI can prompt correctly.
  if (/^CRITICAL_BLOCK:/i.test(text)) {
    return {
      isBlocked: true,
      error: 'CRITICAL_BLOCK',
      message: text.replace(/^CRITICAL_BLOCK:\s*/i, '').trim() || text,
      requires_clarification: true,
    };
  }
  if (/^BLOCK_/i.test(text) || /^BLOCK:/i.test(text)) {
    return {
      isBlocked: true,
      error: 'BLOCKED',
      message: text.replace(/^BLOCK[_:]?\s*/i, '').trim() || text,
      requires_clarification: true,
    };
  }

  return { isBlocked: false };
}
