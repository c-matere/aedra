import { Injectable, Logger } from '@nestjs/common';
import Groq from 'groq-sdk';
import { withRetry } from '../common/utils/retry';

@Injectable()
export class QueryEnrichmentService {
    private readonly logger = new Logger(QueryEnrichmentService.name);
    private groq: Groq;
    private readonly modelName = 'llama-3.1-8b-instant';

    constructor() {
        this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'dummy-key' });
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

        // Handle single characters or punctuation (e.g. "?", ".", "!")
        if (/^[?!.]+$/.test(message.trim())) {
            this.logger.log(`Skipping enrichment for punctuation-only message: "${message}"`);
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
Expand the following vague user message into a detailed request for the AI assistant.
- NEVER include explanations, summaries, or conversational filler like "I expanded this for you".
- NEVER output "Selection Required" or internal state descriptions.
- ONLY output the text that a user would have typed if they were being very specific.
- If they mention a name like "maggy", assume they mean a tenant named Maggie.
- If they mention "payment history", they want to see the payment list for that person.
- If they say "who hasn't paid", they want an arrears report for the company.

[USER MESSAGE]
"${message}"

[OUTPUT]
Provide ONLY the expanded prompt text. Strictly no prefixes or suffixes.
`;

        try {
            const completion = await withRetry(() => this.groq.chat.completions.create({
                model: this.modelName,
                messages: [
                    { role: 'system', content: 'You are a Query Enrichment specialist. Expand short messages into detailed requests.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.1,
                max_tokens: 150,
            }));

            const enriched = completion.choices[0]?.message?.content?.trim() || message;
            
            this.logger.log(`Enriched query: "${enriched}"`);
            return enriched;
        } catch (error) {
            this.logger.error(`Query enrichment failed: ${error.message}`);
            return message; // Fallback to original
        }
    }
}
