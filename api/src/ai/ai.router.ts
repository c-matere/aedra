export type AiModelKey = 'read' | 'write' | 'report';

export const selectModelKey = (message: string, history: any[] = []): AiModelKey => {
    const text = (message || '').toLowerCase();

    if (text.startsWith('/write')) return 'write';
    if (text.startsWith('/report')) return 'report';
    if (text.startsWith('/read')) return 'read';

    const writeHints = [
        'create', 'add', 'record', 'update', 'edit', 'change', 'assign', 'schedule',
        'complete', 'mark', 'set status', 'new tenant', 'new lease', 'new invoice', 'new request',
        'log payment', 'raise request', 'maintenance request', 'trigger', 'start',
        'initiate', 'workflow', 'high', 'medium', 'low', 'urgent', 'plumbing',
        'electrical', 'appliance', 'structural', 'hvac', 'pest_control',
        'sink', 'leak', 'toilet', 'broken', 'repair', 'fix', 'damage', 'bill', 'invoice'
    ];
    const reportHints = [
        'report', 'summary', 'breakdown', 'revenue', 'income', 'expenses', 'cashflow',
        'profit', 'loss', 'collection', 'arrears', 'financial', 'performance',
        'statement', 'p&l', 'trend', 'monthly', 'quarter', 'yearly', 'export', 'csv', 'pdf'
    ];

    // Priority 1: Direct model overrides if present in keywords/hints
    if (writeHints.some((h) => text.includes(h))) return 'write';
    if (reportHints.some((h) => text.includes(h))) return 'report';

    // Priority 2: Contextual stickiness (History-based)
    if (history && history.length > 0) {
        const lastTurn = history[history.length - 1];
        const lastAiMsg = (lastTurn.content || lastTurn.message || '').toLowerCase();

        // If AI just asked for confirmation or specific details for a write action
        const aiAskingForWriteDetail = [
            'confirm', 'proceed', 'sure', 'priority', 'company', 'company?', 'which manager', 'category', 'status', 'due date', 'amount'
        ].some(h => lastAiMsg.includes(h));

        // If we are coming from a write intent in the very recent past
        const recentUserMsgs = history.slice(-4).filter(m => m.role === 'user');
        const hasRecentWriteIntent = recentUserMsgs.some(m =>
            writeHints.some(h => (m.content || m.message || '').toLowerCase().includes(h))
        );

        if (aiAskingForWriteDetail || hasRecentWriteIntent) {
            // But don't stick to write if the user clearly just switched to a report hint
            if (!reportHints.some(h => text.includes(h))) {
                return 'write';
            }
        }
    }

    // Sticky routing: If the message is a short affirmative/follow-up, stick to write
    const commonFollowUps = [
        'yes', 'no', 'confirm', 'confirmed', 'proceed', 'correct', 'y', 'n', 'ok', 'okay',
        'sure', 'go ahead', 'do it', 'make it', 'create it', 'true', 'false', 'absolutely'
    ];
    const shortText = text.trim();

    if (commonFollowUps.some(f => shortText === f || shortText.startsWith(f + ' ')) && history.length > 0) {
        return 'write';
    }

    return 'read';
};
