import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppFormatterService } from './whatsapp-formatter.service';
import {
  NextStepOrchestrator,
  ActionResult,
} from './next-step-orchestrator.service';

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
    result: any,
    sender: any,
    companyId: string,
    language: string,
  ): Promise<{
    text: string;
    interactive?: any;
    menuOptions?: { key: string; label: string; action: string }[];
  }> {
    // Handle raw string results from tools (common in read-tools)
    if (typeof result === 'string') {
      return { text: result };
    }

    // Handle normalized ActionResult where data is already a ready-to-send string
    if (typeof result?.data === 'string' && result.data.trim()) {
      return { text: result.data };
    }

    const actualResult = result?.data || result;
    const isClarification = actualResult?.requires_clarification || result?.requires_clarification;

    if (isClarification) {
      return {
        text: actualResult.message || result.message || 'I need more information to complete that.',
        menuOptions: actualResult.options || result.options,
      };
    }

    if (!result?.success) {
      // result.error can be a code string (e.g. 'MISSING_SESSION') or undefined
      const errorDetail =
        result?.message ||
        (typeof result?.error === 'string' && !result.error.match(/^[A-Z_]+$/)
          ? result.error
          : null);
      const errorMsg =
        language === 'sw'
          ? `Pole sana, kuna tatizo. Tafadhali jaribu tena.${errorDetail ? ` (${errorDetail})` : ''}`
          : `Sorry, I ran into a problem. Please try again.${errorDetail ? ` (${errorDetail})` : ''}`;
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
    const company =
      companyId && companyId !== 'NONE'
        ? await this.prisma.company
            .findUnique({
              where: { id: companyId },
              include: { 
                _count: { select: { properties: true } },
                properties: {
                   include: {
                     units: {
                       include: {
                         leases: {
                           where: { status: 'ACTIVE', deletedAt: null },
                           include: {
                             invoices: { where: { deletedAt: null } },
                             payments: { where: { deletedAt: null } }
                           }
                         }
                       }
                     }
                   }
                }
              },
            })
            .catch(() => null)
        : null;

    // Calculate collection rate (best effort)
    let collectionRate = 0;
    if (company?.properties) {
      let totalInvoiced = 0;
      let totalCollected = 0;
      for (const prop of company.properties) {
        for (const unit of prop.units) {
          for (const lease of unit.leases) {
            totalInvoiced += lease.invoices.reduce((sum, inv) => sum + inv.amount, 0);
            totalCollected += lease.payments.reduce((sum, pay) => sum + pay.amount, 0);
          }
        }
      }
      if (totalInvoiced > 0) {
        collectionRate = Math.round((totalCollected / totalInvoiced) * 100);
      }
    }

    const nextStep = this.orchestrator.computeNextStep(result, {
      companyName: company?.name,
      propertyCount: company?._count?.properties,
      collectionRate,
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

    return { text: response, interactive, menuOptions: nextStep?.options };
  }
}
