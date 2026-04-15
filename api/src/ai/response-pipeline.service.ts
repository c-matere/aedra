import { Injectable, Logger } from '@nestjs/common';
import { renderTemplate } from './templates';
import { SKILLS_REGISTRY } from './skills.registry';

export interface PipelineResult {
  success: boolean;
  output?: string;
  structuredData?: any;
  errors?: string[];
}

@Injectable()
export class ResponsePipelineService {
  private readonly logger = new Logger(ResponsePipelineService.name);

  /**
   * Orchestrates the response transformation pipeline.
   */
  async processResponse(
    skillId: string,
    rawJson: string,
  ): Promise<PipelineResult> {
    try {
      // Stage 1: Extraction & Parsing
      const parsedData = JSON.parse(rawJson);
      const skill = SKILLS_REGISTRY.find((s) => s.skill_id === skillId);

      if (!skill) {
        return {
          success: false,
          errors: ['Something went wrong. Please try again.'],
        };
      }

      // Stage 2: Deterministic Validation (Schema & Safety)
      const validationErrors = this.validate(skill, parsedData);
      if (validationErrors.length > 0) {
        return {
          success: false,
          structuredData: parsedData,
          errors: validationErrors,
        };
      }

      // Stage 3: Template Rendering
      const language = parsedData.language || 'EN';
      const renderedText = renderTemplate(
        skillId,
        language,
        parsedData,
        parsedData.tone,
      );

      if (!renderedText) {
        return {
          success: false,
          structuredData: parsedData,
          errors: ['Failed to render template.'],
        };
      }

      // Stage 4: Delivery Formatting (WhatsApp Markdown)
      const formattedText = this.applyWhatsAppFormatting(renderedText);

      return {
        success: true,
        output: formattedText,
        structuredData: parsedData,
      };
    } catch (error) {
      this.logger.error(
        `Pipeline processing failed: ${error.message}`,
        error?.stack,
      );
      return {
        success: false,
        errors: ['Something went wrong. Please try again.'],
      };
    }
  }

  private validate(skill: any, data: any): string[] {
    const errors: string[] = [];

    // Simple schema presence check
    const required = skill.outputSchema.required || [];
    for (const field of required) {
      if (
        data[field] === undefined ||
        data[field] === null ||
        data[field] === ''
      ) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Safety: Check for PII or prohibited patterns
    const prohibited = ['password', 'secret', 'token', 'apiKey', 'credential'];
    const dataString = JSON.stringify(data).toLowerCase();

    for (const word of prohibited) {
      if (dataString.includes(word)) {
        errors.push(
          `Safety violation: Output contains prohibited term "${word}".`,
        );
      }
    }

    // Check for common hallucination placeholders
    const placeholders = [
      '[placeholder]',
      '{{placeholder}}',
      'YOUR_NAME_HERE',
      '0700000000',
    ];
    for (const p of placeholders) {
      if (dataString.includes(p.toLowerCase())) {
        errors.push(`Quality violation: Output contains placeholder "${p}".`);
      }
    }

    return errors;
  }

  private applyWhatsAppFormatting(text: string): string {
    // Ensure KES and amounts are bolded for premium readability
    let formatted = text
      .replace(/(KES\s?\d+(?:,\d+)*(?:\.\d+)?)/g, '*$1*')
      .replace(/\*(?:\s*)(\*)/g, '$1'); // Cleanup potential double bolding

    // Final table-to-list fallback if anything slipped through
    // We would need to inject WhatsAppFormatterService here to use its method,
    // but for now we can rely on its global use in AiService/Orchestrator.
    // Actually, I'll add a simple local version or just rely on the orchestrator.

    // Safety: Convert malformed or unintended Markdown links [label](url) to plain URLs for WhatsApp
    formatted = formatted.replace(
      /\[(?:.*?)\]\((https?:\/\/[^\s\)]+)\)/g,
      '$1',
    );

    return formatted;
  }
}
