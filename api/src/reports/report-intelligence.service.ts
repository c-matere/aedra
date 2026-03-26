import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from '../prisma/prisma.service';
import { CriticService } from '../ai/critic.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { minifyReportData } from '../ai/ai-minifier.util';
import * as crypto from 'crypto';
import Groq from 'groq-sdk';

@Injectable()
export class ReportIntelligenceService {
  private readonly logger = new Logger(ReportIntelligenceService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly modelName: string;

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => CriticService))
    private critic: CriticService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly groq: Groq,
  ) {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    this.modelName = 'gemini-2.5-pro';
  }

  /**
   * Generates deep insights and a professional narrative for a property portfolio.
   * Consolidates McKinsey Analyst, Writer, and Design layers into a single high-efficiency prompt.
   */
  async generatePremiumInsights(data: any, modelOverride?: string) {
    const selectedModel = modelOverride || this.modelName;

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

    this.logger.log(
      `Starting Consolidated McKinsey-grade intelligence using model: ${selectedModel}...`,
    );

    // Minify data to save tokens and reduce LLM providers spam
    const minifiedData = minifyReportData(data);

    const prompt = `
# SYSTEM: PREMIER MCKINSEY-GRADE PROPERTY INTELLIGENCE ANALYST
You are Aedra's elite intelligence engine. Analyze the following portfolio data: ${JSON.stringify(minifiedData)}

## MANDATE
Produce a high-fidelity, McKinsey-grade portfolio intelligence report. Output your findings as a PURE JSON OBJECT that follows the exact structure required for our premium visual components.

### ANALYSIS REQUIREMENTS
1. **Executive Summary**: A punchy, data-driven summary (3-4 sentences). Identify the single most important trend and the top priority action.
2. **Yield Waterfall**: Construct a financial waterfall from Gross Rent to Net Yield. Include entries for Vacancies, Arrears, and Maintenance. Provide short "notes" for each (e.g., "Block C heavy").
3. **Payment Heatmap**: Generate a 5-month payment history for the top 5-7 most relevant tenants. Include an "LTV score" (0-100) based on their consistency. Use statuses: "ok", "late", "missed".
4. **Deep Patterns**: Identify 3-4 "silent" patterns (e.g., maintenance yield traps, seasonal cohort risks, payment method shifts).
5. **Risk Flags**: Identify the most critical risks (Red/Amber) with specific details (e.g., specific unit numbers or structural cost trends).
6. **Recommendations**: Provide 3-4 high-impact, time-bound recommendations.

## OUTPUT STRUCTURE (JSON)
{
  "execBadge": "Strong performance | At Risk | Stable",
  "execSummary": "Strategic narrative...",
  "waterfall": [
    { "label": "Gross rent", "value": 2500000, "type": "positive" },
    { "label": "Vacancies", "value": -150000, "type": "negative", "note": "..." },
    { "label": "Arrears", "value": -120000, "type": "negative", "note": "..." },
    { "label": "Maintenance", "value": -210000, "type": "negative", "note": "..." },
    { "label": "Net yield", "value": 2020000, "type": "total" }
  ],
  "heatmap": [
    { "name": "Tenant Name", "unit": "A1", "nov": "ok", "dec": "ok", "jan": "late", "feb": "ok", "mar": "ok", "ltv": 92 }
  ],
  "patterns": [
    { "tag": "Pattern Title", "body": "Detailed insight..." }
  ],
  "risks": [
    { "level": "red | amber | green", "label": "Title", "detail": "Detailed risk description..." }
  ],
  "recommendations": [
    { "action": "Specific action...", "deadline": "By March 18th" }
  ]
}

## STYLE & TONE
- Professional, concise, and strategic.
- Use African/Kenyan currency (KES) and context where appropriate.
- Focus on ROI and protective actions.
- Do NOT provide prose outside the JSON object.
`;

    const isGroq = selectedModel.includes('/') || selectedModel.startsWith('llama');

    try {
      this.logger.log(
        `Running premium analysis with model ${selectedModel}...`,
      );
      
      let text = '';
      if (isGroq) {
        const completion = await this.groq.chat.completions.create({
          model: selectedModel,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.4,
        });
        text = completion.choices[0]?.message?.content || '{}';
      } else {
        const model = this.genAI.getGenerativeModel({
          model: selectedModel,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.4,
          },
        });
        const result = await model.generateContent(prompt);
        text = result.response.text();
      }
      
      const parsed = JSON.parse(text);

      // Generator-Critic Loop: Validate report consistency
      this.logger.log(
        'Strategic analysis complete. Initiating Critic evaluation...',
      );
      const verdict = await this.critic.evaluate(
        'PORTFOLIO_REPORT',
        JSON.stringify(parsed),
        `Portfolio report for ${data.property?.name || 'the portfolio'}. Data summary: Occupancy ${data.totals?.occupancy}%`,
      );

      if (!verdict.pass) {
        this.logger.warn(
          `Critic flagged report. feedback: ${verdict.feedback.join(', ')}`,
        );
        parsed.criticNote = verdict.feedback.join(' | ');
      }

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
