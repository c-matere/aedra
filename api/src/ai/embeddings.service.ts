import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { withRetry } from '../common/utils/retry';

@Injectable()
export class EmbeddingsService {
    private readonly logger = new Logger(EmbeddingsService.name);
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        this.genAI = new GoogleGenerativeAI(apiKey || 'dummy-key');
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
    }

    async generateEmbedding(text: string): Promise<number[]> {
        try {
            const result = await withRetry<any>(() => this.model.embedContent({
                content: { parts: [{ text }], role: 'user' },
                outputDimensionality: 768
            }));
            return result.embedding.values;
        } catch (error) {
            this.logger.error(`Failed to generate embedding: ${error.message}`);
            throw error;
        }
    }

    /**
     * Helper to format double array for postgres vector type: '[0.1, 0.2, ...]'
     */
    formatForPostgres(values: number[]): string {
        return `[${values.join(',')}]`;
    }

    // Lightweight placeholder search for compatibility with callers.
    async search(query: string, _opts?: { topK?: number; filters?: Record<string, any> }): Promise<{ id: string; score?: number }[]> {
        this.logger.warn('EmbeddingsService.search is a stub; returning empty results.');
        return [];
    }
}
