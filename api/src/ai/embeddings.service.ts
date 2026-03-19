import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { withRetry } from '../common/utils/retry';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmbeddingsService {
    private readonly logger = new Logger(EmbeddingsService.name);
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor(private readonly prisma: PrismaService) {
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

    /**
     * Perform semantic search using pgvector cosine distance (<=>)
     */
    async search(query: string, opts?: { topK?: number; filters?: Record<string, any> }): Promise<{ id: string; score?: number }[]> {
        try {
            const vector = await this.generateEmbedding(query);
            const vectorStr = this.formatForPostgres(vector);
            const limit = opts?.topK || 10;
            const companyId = opts?.filters?.companyId;
            const type = opts?.filters?.type?.toUpperCase() || 'TENANT';

            let table = 'Tenant';
            if (type === 'PROPERTY') table = 'Property';
            if (type === 'UNIT') table = 'Unit';
            if (type === 'MAINTENANCE') table = 'MaintenanceRequest';

            // Raw SQL query to use pgvector operator
            // Note: We use string interpolation for table name because it's validated, 
            // and Prisma queryRaw handles the vectorStr as a bound parameter.
            const results: any[] = await this.prisma.$queryRawUnsafe(`
                SELECT id, (embedding <=> $1::vector) as distance
                FROM "${table}"
                WHERE "deletedAt" IS NULL
                ${companyId ? `AND "companyId" = '${companyId}'` : ''}
                ORDER BY distance ASC
                LIMIT ${limit}
            `, vectorStr);

            return results.map(r => ({
                id: r.id,
                score: 1 - r.distance // Converrt distance to similarity score
            }));
        } catch (error) {
            this.logger.error(`EmbeddingsService.search failed: ${error.message}`);
            return [];
        }
    }
}
