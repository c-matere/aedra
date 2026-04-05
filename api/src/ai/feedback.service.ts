import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface RecordFeedbackDto {
  phone: string;
  traceId?: string;
  intentType: string;
  score: number;        // 1–5, or -1/1 for thumbs down/up
  comment?: string;
  language?: string;
  companyId?: string;
}

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record a CSAT or thumbs score from a WhatsApp button reply.
   */
  async recordFeedback(dto: RecordFeedbackDto): Promise<void> {
    try {
      await (this.prisma as any).conversationFeedback.create({
        data: {
          phone: dto.phone,
          traceId: dto.traceId,
          intentType: dto.intentType,
          score: dto.score,
          comment: dto.comment,
          language: dto.language || 'en',
          companyId: dto.companyId,
        },
      });
      this.logger.log(`[Feedback] Recorded score=${dto.score} for ${dto.phone} (intent=${dto.intentType})`);
    } catch (e) {
      this.logger.warn(`[Feedback] Failed to record feedback: ${e.message}`);
    }
  }

  /**
   * Get average feedback scores per intent (for admin dashboard / weekly digest).
   */
  async getIntentScoreSummary(companyId?: string): Promise<any[]> {
    try {
      const where: any = {};
      if (companyId) where.companyId = companyId;

      const results = await (this.prisma as any).conversationFeedback.groupBy({
        by: ['intentType'],
        where,
        _avg: { score: true },
        _count: { score: true },
        orderBy: { _avg: { score: 'asc' } },
      });

      return results.map((r: any) => ({
        intent: r.intentType,
        avgScore: Math.round((r._avg.score || 0) * 10) / 10,
        count: r._count.score,
        needsAttention: r._avg.score < 3.5,
      }));
    } catch (e) {
      this.logger.warn(`[Feedback] Failed to get summary: ${e.message}`);
      return [];
    }
  }
}
