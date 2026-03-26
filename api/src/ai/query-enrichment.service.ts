import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { withRetry } from '../common/utils/retry';

@Injectable()
export class QueryEnrichmentService {
  private readonly logger = new Logger(QueryEnrichmentService.name);
  private readonly modelName = 'gemini-2.5-pro';

  constructor(private readonly genAI: GoogleGenerativeAI) {}

  private shouldSkipEnrichment(message: string): boolean {
    const text = (message || '').toLowerCase();

    const hasPropertyKeyword =
      /\bhouse\b|\bnyumba\b|\bunit\b|\bapartment\b|\bflat\b|\bproperty\b|\bplot\b/i.test(
        text,
      );
    const hasNumberRef =
      /\b\d{1,4}\b/.test(text) || /\bno\.\b|\b#\b/i.test(text);
    const hasInterestSignal =
      /\binterested\b|\bintrested\b|\bintersted\b|\blooking for\b|\bavailable\b|\bvacant\b|\bfor rent\b|\brenting\b|\bto rent\b|\bview\b|\bvisit\b|\bschedule\b|\bbei\b|\bprice\b|\bnataka kupanga\b|\bipo waz/i.test(
        text,
      );

    // Property-interest queries are often already clear and are high risk for hallucination
    // (e.g. inventing residents, payment history, or ID requests). Keep them verbatim.
    if ((hasPropertyKeyword && hasNumberRef) || hasInterestSignal) return true;

    // If message already contains a UUID, it is likely precise.
    const hasUuid =
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(
        text,
      );
    if (hasUuid) return true;

    return false;
  }

  /**
   * Enriches short or vague queries by adding context or intent based on history.
   */
  async enrich(message: string, history: any[], context: any): Promise<string> {
    const wordCount = message.split(/\s+/).filter(Boolean).length;

    // Skip enrichment for longer or already detailed messages
    if (wordCount > 10 || message.length > 60) {
      return message;
    }

    if (!this.genAI) {
      return message;
    }

    // Handle single characters or punctuation (e.g. "?", ".", "!")
    if (/^[?!.]+$/.test(message.trim())) {
      this.logger.log(
        `Skipping enrichment for punctuation-only message: "${message}"`,
      );
      return message;
    }

    if (this.shouldSkipEnrichment(message)) {
      this.logger.log(
        `Skipping enrichment for property-specific/interest message: "${message}"`,
      );
      return message;
    }

    this.logger.log(`Enriching vague query: "${message}"`);

    const historySnippet = history
      .slice(-3)
      .map((h) => `${h.role}: ${h.parts?.[0]?.text || ''}`)
      .join('\n');

    const prompt = `
[ROLE]
You are a "Query Enrichment" specialist for Aedra Property Management AI. 
Short, vague requests come from WhatsApp. Your job is to flesh them out into clear, actionable prompts for the main AI engine.

[USER CONTEXT]
- Role: ${context.role}
- Company ID: ${context.companyId || 'Unknown'}
- Recent History:
${historySnippet || 'No recent history'}

[TASK]
Expand the following vague user message into a detailed request for the AI assistant.
- NEVER include explanations, summaries, or conversational filler like "I expanded this for you".
- NEVER output "Selection Required" or internal state descriptions.
- ONLY output the text that a user would have typed if they were being very specific.
- DO NOT invent facts, people, residents, payment records, repairs, IDs, or document numbers that are not explicitly in the user message.
- DO NOT ask for national/citizen ID numbers unless the user explicitly asked to update ID/KYC details.
- If they mention a name like "maggy", assume they mean a tenant named Maggie.
- If they mention "payment history", they want to see the payment list for that person.
- If they say "who hasn't paid", they want an arrears report for the company.

[USER MESSAGE]
"${message}"

[OUTPUT]
Provide ONLY the expanded prompt text. Strictly no prefixes or suffixes.
`;

    try {
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
        generationConfig: { temperature: 0.1, maxOutputTokens: 150 },
      });

      const completion = await withRetry(() =>
        model.generateContent({
          contents: [{ role: 'user', parts: [{ text: `${'You are a Query Enrichment specialist. Expand short messages into detailed requests.'}\n\n${prompt}` }] }]
        })
      );

      const enriched =
        completion.response.text()?.trim() || message;

      this.logger.log(`Enriched query: "${enriched}"`);
      return enriched;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Query enrichment failed (returning original): ${msg}`);
      return message; // Safe fallback to original
    }
  }
}
