import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppFormatterService } from './whatsapp-formatter.service';
import { NextStepOrchestrator, ActionResult } from './next-step-orchestrator.service';

@Injectable()
export class AiFormatterService {
  private readonly logger = new Logger(AiFormatterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappFormatter: WhatsAppFormatterService,
    private readonly orchestrator: NextStepOrchestrator,
  ) {}

  /**
   * Formats a tool execution result into a user-friendly response.
   */
  async formatToolResponse(
    result: ActionResult,
    sender: any,
    companyId: string,
    language: string,
  ): Promise<{ text: string; interactive?: any }> {
    if (!result.success) {
      // Basic fallback error message
      const errorMsg = language === 'sw' 
        ? `Pole sana, kuna tatizo: ${result.error}` 
        : `I encountered an error: ${result.error}`;
      
      return { text: errorMsg };
    }

    if (result.requires_authorization) {
      const interactive = this.whatsappFormatter.buildAuthButtons(
        result.message || 'Authorization required',
        result.actionId || 'none',
        language,
      );
      return {
        text: result.message || 'Authorization required',
        interactive,
      };
    }

    // Default formatting via WhatsAppFormatter
    const formatted = this.whatsappFormatter.formatResult(
      result.action || 'unknown',
      result.data,
      language,
    );
    
    let response = formatted.text;
    let interactive = formatted.interactive;

    // Add contextual next steps via Orchestrator
    const company = companyId && companyId !== 'NONE'
        ? await this.prisma.company.findUnique({
              where: { id: companyId },
              include: { _count: { select: { properties: true } } },
            }).catch(() => null)
        : null;

    const nextStep = this.orchestrator.computeNextStep(result, {
      companyName: company?.name,
      propertyCount: company?._count?.properties,
      language: (language as any) || 'en',
    });

    if (nextStep) {
      response += `\n\n${this.orchestrator.formatNextStep(nextStep)}`;
      if (!interactive && nextStep.options) {
        interactive = this.whatsappFormatter.buildButtonMessage(
          response,
          nextStep.options,
          language,
        );
      }
    }

    return { text: response, interactive };
  }
}
