import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ClassificationResult } from './ai-contracts.types';

@Injectable()
export class AiBrainClient {
  private readonly logger = new Logger(AiBrainClient.name);
  private readonly BRAIN_URL = process.env.BRAIN_SERVICE_URL || 'http://localhost:5000';

  constructor(private readonly http: HttpService) {}

  /**
   * Proxies a chat request to the standalone Brain service.
   */
  async chat(
    message: string,
    context: any,
    userId: string | null = 'unidentified',
    chatId: string | null = null,
    phone: string | null = null,
    companyId: string | null = null,
  ): Promise<any> {
    try {
      this.logger.log(`[BrainClient] Proxying chat request to Brain (${this.BRAIN_URL})`);
      const response = await firstValueFrom(
        this.http.post(`${this.BRAIN_URL}/ai/chat`, {
          message,
          context,
          userId,
          chatId,
          phone,
          companyId,
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`[BrainClient] Chat request failed: ${error.message}`);
      return {
        response: "I'm having trouble connecting to my central reasoning engine. Please try again in a moment.",
        chatId: chatId,
      };
    }
  }

  // Simplified proxy for reset session
  async resetSession(userId: string, chatId: string) {
    try {
      const response = await firstValueFrom(
        this.http.post(`${this.BRAIN_URL}/ai/chat/reset`, { userId, chatId }),
      );
      return response.data;
    } catch (error) {
       this.logger.error(`[BrainClient] Reset session failed: ${error.message}`);
       return { cleared: false, error: error.message };
    }
  }

  async summarizeForWhatsApp(text: string, language: string): Promise<string> {
    try {
      const response = await firstValueFrom(
        this.http.post(`${this.BRAIN_URL}/whatsapp/summarize`, { text, language })
      );
      return response.data.summary || text;
    } catch (e) {
      this.logger.error(`Summarization failed: ${e.message}`);
      return text;
    }
  }

  // Proxy for takeover advice (WhatsApp recovery)
  async generateTakeoverAdvice(input: any, history: any[]) {
    try {
      const response = await firstValueFrom(
        this.http.post(`${this.BRAIN_URL}/ai/takeover-advice`, { ...input, history }),
      );
      return response.data;
    } catch (error) {
      this.logger.error(`[BrainClient] Takeover advice failed: ${error.message}`);
      return { response: "I'm having trouble analyzing this conversation right now." };
    }
  }
  
  async recordSentiment(tenantId: string, sentiment: number) {
    try {
      this.logger.log(`[BrainClient] Reporting sentiment for tenant ${tenantId}: ${sentiment}`);
      const response = await firstValueFrom(
        this.http.post(`${this.BRAIN_URL}/ai/narrative/record`, { tenantId, sentiment }),
      );
      return response.data;
    } catch (error) {
       this.logger.error(`[BrainClient] Sentiment recording failed: ${error.message}`);
       return { success: false };
    }
  }

  /**
   * Proxies a classification request to the Brain.
   */
  async classify(text: string, role: string, language?: string, context?: any): Promise<ClassificationResult> {
    try {
      const response = await firstValueFrom(
        this.http.post(`${this.BRAIN_URL}/ai/classify`, { text, role, language, context }),
      );
      return response.data;
    } catch (error) {
      this.logger.error(`[BrainClient] Classification failed: ${error.message}`);
      return { 
        intent: 'unknown', 
        priority: 'NORMAL', 
        confidence: 0, 
        complexity: 1, 
        executionMode: 'LIGHT_COMPOSE', 
        language: language || 'en', 
        reason: 'error fallback' 
      };
    }
  }

  /**
   * Proxies a critic/evaluation request to the Brain.
   */
  async evaluate(type: string, content: string, data: any) {
    try {
      const response = await firstValueFrom(
        this.http.post(`${this.BRAIN_URL}/ai/evaluate`, { type, content, data }),
      );
      return response.data;
    } catch (error) {
      this.logger.error(`[BrainClient] Evaluation failed: ${error.message}`);
      return { pass: true, feedback: [] }; // Fail open for now
    }
  }

  /**
   * Proxies a premium report analysis request to the Brain.
   */
  async generatePremiumInsights(data: any) {
    try {
      this.logger.log(`[BrainClient] Proxying Premium Insights request to Brain`);
      const response = await firstValueFrom(
        this.http.post(`${this.BRAIN_URL}/reports/insights`, { data })
      );
      return response.data;
    } catch (error) {
      this.logger.error(`[BrainClient] Premium Insights request failed: ${error.message}`);
      throw error;
    }
  }
}
