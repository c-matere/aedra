import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiBrainClient } from '../ai/ai-brain.client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { minifyReportData } from '../ai/ai-minifier.util';
import * as crypto from 'crypto';

@Injectable()
export class ReportIntelligenceService {
  private readonly logger = new Logger(ReportIntelligenceService.name);

  constructor(
    private prisma: PrismaService,
    private brainClient: AiBrainClient,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Generates deep insights and a professional narrative for a property portfolio.
   * Delegated to the Central Reasoning Brain.
   */
  async generatePremiumInsights(data: any, _modelOverride?: string) {
    // Detect if we have a fresh cached version
    const propertyId = data.property?.id || 'portfolio';
    const dataHash = crypto
      .createHash('md5')
      .update(JSON.stringify(data.totals || {}))
      .digest('hex');
    const cacheKey = `premium_insights:${data.companyId}:${propertyId}:${dataHash}`;

    try {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        this.logger.log(
          `Serving Premium Insights from cache for key: ${cacheKey}`,
        );
        return cached;
      }
    } catch (e) {
      this.logger.warn(`Failed to read report cache: ${e.message}`);
    }

    this.logger.log(`Starting Premium Insights intelligence via Brain Proxy...`);

    // Minify data to save tokens and bandwidth
    const minifiedData = minifyReportData(data);

    try {
      const parsed = await this.brainClient.generatePremiumInsights(minifiedData);

      this.logger.log('Strategic analysis complete.');
      const finalReport = {
        ...parsed,
        timestamp: new Date().toISOString(),
      };

      // Cache for 24 hours to reduce LLM spamming
      await this.cacheManager
        .set(cacheKey, finalReport, 86400 * 1000)
        .catch(() => {});

      return finalReport;
    } catch (err) {
      this.logger.error(
        `Error in strategic analysis: ${err.message}`,
        err.stack,
      );
      // Fallback to basic summary if AI fails
      return {
        execBadge: 'Data Overview',
        execSummary: `This report analyzes ${data.totals?.units || 0} units for ${data.property?.name || 'the portfolio'}. Total monthly revenue is approximately KES ${data.totals?.payments?.toLocaleString() || 0}.`,
        waterfall: [
          {
            label: 'Gross rent',
            value: data.totals?.invoices || 0,
            type: 'positive',
          },
          {
            label: 'Arrears',
            value: -(data.totals?.invoices - data.totals?.payments) || 0,
            type: 'negative',
            note: 'Outstanding balance',
          },
          {
            label: 'Maintenance',
            value: -(data.totals?.expenses || 0),
            type: 'negative',
            note: 'Recorded expenses',
          },
          {
            label: 'Net yield',
            value: (data.totals?.payments || 0) - (data.totals?.expenses || 0),
            type: 'total',
          },
        ],
        heatmap: [],
        patterns: [
          {
            tag: 'Financial Snapshot',
            body: `Revenue: KES ${data.totals?.payments?.toLocaleString()}. Expenses: KES ${data.totals?.expenses?.toLocaleString()}.`,
          },
        ],
        risks: [],
        recommendations: [
          { action: 'Follow up on overdue invoices', deadline: 'Immediately' },
        ],
        timestamp: new Date().toISOString(),
      };
    }
  }
}
