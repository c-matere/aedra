import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { withRetry } from '../common/utils/retry';

@Injectable()
export class QueryEnrichmentService {
    private readonly logger = new Logger(QueryEnrichmentService.name);
    private genAI: GoogleGenerativeAI;
    private readonly modelName = 'gemini-1.5-flash';

    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy-key');
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

        this.logger.log(`Enriching vague query: "${message}"`);

        const historySnippet = history.slice(-3).map(h => `${h.role}: ${h.parts?.[0]?.text || ''}`).join('\n');
        
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
Expand the following vague user message into a detailed request. 
- If they mention a name like "maggy", assume they mean a tenant named Maggie.
- If they mention "payment history", they want to see the payment list for that person.
- If they say "who hasn't paid", they want an arrears report for the company.
- Keep the tone professional but match the user's intent.

[USER MESSAGE]
"${message}"

[OUTPUT]
Provide ONLY the expanded prompt. Do not include prefixes like "Enhanced Prompt:" or conversational filler.
`;

        try {
            const model = this.genAI.getGenerativeModel({ model: this.modelName });
            const result = await withRetry(() => model.generateContent(prompt));
            const enriched = result.response.text().trim();
            
            this.logger.log(`Enriched query: "${enriched}"`);
            return enriched;
        } catch (error) {
            this.logger.error(`Query enrichment failed: ${error.message}`);
            return message; // Fallback to original
        }
    }
}
