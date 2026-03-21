import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { withRetry } from '../common/utils/retry';

export type AiModelKey = 'read' | 'write' | 'report';

const CLASSIFIER_PROMPT = `
You are an intent classifier for "Aedra", a property management AI co-worker.
Classify the user's message into one of three intents:
1. "read": Retrieving information (listing tenants, checking rent balance, showing property details).
2. "write": Creating, updating, or deleting data (adding a tenant, recording a payment, creating a maintenance request, changing unit status).
3. "report": Generating structured summaries, financial breakdowns, or PDF/CSV exports (revenue reports, collection summaries, arrears breakdown).

Output ONLY a JSON object with this structure:
{"intent": "read" | "write" | "report", "confidence": number (0.0 to 1.0), "reason": "short explanation"}

Context matters:
- Affirmations ("yes", "proceed", "sawa", "endelea") usually follow a "write" action.
- "Bill", "Invoice", "Repair", "Fix" are usually "write" intents if they imply creating something.
- "Summarise", "Totals", "Performance", "Ripoti", "Muhtasari" are usually "report".

Language Support:
- You support both English and Swahili (Kiswahili). Classify strictly based on intent regardless of the language used.
- Example Swahili intents: "Nionyeshe nani hajalipa" -> read, "Ongeza mpangaji" -> write, "Nataka ripoti ya mapato" -> report.

User Message:
`;

// Use the same base model everywhere; allow override via GEMINI_MODEL, otherwise default to gemini-2.5-flash
const ROUTER_MODEL =
  (process.env.GEMINI_MODEL || '').trim() || 'gemini-1.5-flash';
const GROQ_ROUTER_MODEL = 'llama-3.1-8b-instant';

export interface RouteResult {
  intent: AiModelKey;
  reason: string;
}

export const selectModelKey = async (
  genAI: GoogleGenerativeAI,
  message: string,
  history: any[] = [],
  routerModelName?: string,
  groq?: Groq,
): Promise<RouteResult> => {
  const text = (message || '').toLowerCase().trim();

  // Fast path: Direct command overrides
  if (text.startsWith('/write'))
    return { intent: 'write', reason: 'Direct command override' };
  if (text.startsWith('/report'))
    return { intent: 'report', reason: 'Direct command override' };
  if (text.startsWith('/read'))
    return { intent: 'read', reason: 'Direct command override' };

  // --- Fast lexical / context path (avoid LLM cost on obvious intents) ---
  const writeHints = [
    'create',
    'add',
    'record',
    'update',
    'edit',
    'change',
    'assign',
    'schedule',
    'complete',
    'mark',
    'set status',
    'new tenant',
    'new lease',
    'new invoice',
    'new request',
    'log payment',
    'raise request',
    'maintenance request',
    'trigger',
    'start',
    'initiate',
    'workflow',
    'high',
    'medium',
    'low',
    'urgent',
    'plumbing',
    'electrical',
    'appliance',
    'structural',
    'hvac',
    'pest_control',
    'sink',
    'leak',
    'toilet',
    'broken',
    'repair',
    'fix',
    'damage',
    'bill',
    'invoice',
    'register',
    'signup',
    'enroll',
    'onboard',
    // Swahili write hints
    'unda',
    'ongeza',
    'rekodi',
    'badilisha',
    'hariri',
    'andika',
    'rekebisha',
    'panga',
    'timiza',
    'weka',
    'mpya',
    'pili',
    'matengenezo',
    'vujisha',
    'choo',
    'bomoka',
    'haribika',
  ];
  const reportHints = [
    'report',
    'summary',
    'breakdown',
    'revenue',
    'income',
    'expenses',
    'cashflow',
    'profit',
    'loss',
    'collection',
    'arrears',
    'financial',
    'performance',
    'statement',
    'p&l',
    'trend',
    'monthly',
    'quarter',
    'yearly',
    'export',
    'csv',
    'pdf',
    // Swahili report hints
    'ripoti',
    'muhtasari',
    'uchambuzi',
    'mapato',
    'matumizi',
    'faida',
    'hasara',
    'mkusanyiko',
    'deni',
    'madeni',
    'kifedha',
    'utendaji',
    'kila mwezi',
    'robo mwaka',
    'mwaka',
    'tuma',
  ];

  if (writeHints.some((h) => text.includes(h)))
    return { intent: 'write', reason: 'Lexical match (write hints)' };
  if (reportHints.some((h) => text.includes(h)))
    return { intent: 'report', reason: 'Lexical match (report hints)' };

  if (history && history.length > 0) {
    const lastTurn = history[history.length - 1];
    const lastAiMsg = (
      lastTurn.content ||
      lastTurn.message ||
      ''
    ).toLowerCase();

    const aiAskingForWriteDetail = [
      'confirm',
      'proceed',
      'sure',
      'priority',
      'company',
      'category',
      'status',
      'due date',
      'amount',
    ].some((h) => lastAiMsg.includes(h));

    const recentUserMsgs = history.slice(-4).filter((m) => m.role === 'user');
    const hasRecentWriteIntent = recentUserMsgs.some((m) =>
      writeHints.some((h) =>
        (m.content || m.message || '').toLowerCase().includes(h),
      ),
    );

    if (aiAskingForWriteDetail || hasRecentWriteIntent) {
      if (!reportHints.some((h) => text.includes(h))) {
        return {
          intent: 'write',
          reason: 'Contextual fallback (AI follow-up or recent write activity)',
        };
      }
    }
  }
  const commonFollowUps = [
    'yes',
    'no',
    'confirm',
    'confirmed',
    'proceed',
    'correct',
    'y',
    'n',
    'ok',
    'okay',
    'sure',
    'go ahead',
    'do it',
    'make it',
    'create it',
    'true',
    'false',
    'absolutely',
    'ndio',
    'sawa',
    'endelea',
    'fanya',
    'thibitisha',
    'ndiyo',
    'izidi',
  ];

  if (
    commonFollowUps.some((f) => text === f || text.startsWith(f + ' ')) &&
    history.length > 0
  ) {
    return { intent: 'write', reason: 'Affirmation / Confirmation follow-up' };
  }

  // --- LLM classification as last resort ---
  try {
    const safeHistory = (history || [])
      .slice(-5)
      .map((h) => {
        const role = typeof h?.role === 'string' ? h.role : 'user';
        const content =
          typeof h?.content === 'string'
            ? h.content
            : typeof h?.message === 'string'
              ? h.message
              : '';
        return `${role}: ${content}`;
      })
      .join('\n');

    const fullPrompt = `${CLASSIFIER_PROMPT}\nHistory Context:\n${safeHistory}\n\nUser Message: "${message}"`;

    let raw = '';
    const runClassification = async () => {
      // Attempt Groq (Primary)
      if (groq) {
        try {
          const chatCompletion = await withRetry(() =>
            groq.chat.completions.create({
              messages: [{ role: 'user', content: fullPrompt }],
              model: GROQ_ROUTER_MODEL,
              response_format: { type: 'json_object' },
            }),
          );
          return chatCompletion.choices[0]?.message?.content || '{}';
        } catch (e) {
          console.warn(
            `[Router] Groq failed, falling back to Gemini... ${e.message}`,
          );
        }
      }

      // Attempt Gemini (Secondary)
      try {
        const model = genAI.getGenerativeModel({
          model: routerModelName || ROUTER_MODEL,
          generationConfig: { responseMimeType: 'application/json' },
        });
        const result = await withRetry(() => model.generateContent(fullPrompt));
        const response = await result.response;
        return response.text();
      } catch (e) {
        console.error(`[Router] All model fallbacks exhausted! ${e.message}`);
        throw e;
      }
    };

    raw = await runClassification();

    try {
      const data = JSON.parse(raw);
      const intent = data?.intent as AiModelKey;
      const confidence = Number(data?.confidence || 0);
      if (
        (intent === 'read' || intent === 'write' || intent === 'report') &&
        confidence > 0.6
      ) {
        return {
          intent,
          reason: data.reason || 'LLM classified with high confidence',
        };
      }
    } catch (jsonErr: any) {
      console.warn(
        'Router JSON parse failed:',
        jsonErr.message,
        raw?.slice(0, 120),
      );
    }
  } catch (error: any) {
    console.warn(
      'AI Router classification failed, falling back to default:',
      error.message,
    );
  }

  return {
    intent: 'read',
    reason: 'Defaulting to read (low confidence / no strong cues)',
  };
};
