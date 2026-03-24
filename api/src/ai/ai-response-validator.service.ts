import { Injectable, Logger } from '@nestjs/common';

export interface ValidationResult {
  isValid: boolean;
  cleanedText: string;
  violations: string[];
}

@Injectable()
export class AiResponseValidatorService {
  private readonly logger = new Logger(AiResponseValidatorService.name);

  /**
   * Validates and cleans the AI response before it reaches the user.
   */
  validate(text: string): ValidationResult {
    const violations: string[] = [];
    let cleaned = text;

    // 1. Check for raw JSON blocks
    if (text.includes('```json') || (text.includes('{') && text.includes('}') && text.includes('"'))) {
      violations.push('Raw JSON detected');
      // Strip JSON markdown if it's just a wrapper
      cleaned = cleaned.replace(/```json[\s\S]*?```/g, (match) => {
        try {
          const content = match.replace(/```json|```/g, '').trim();
          const parsed = JSON.parse(content);
          return parsed.response || parsed.message || '';
        } catch (e) {
          return ''; // Strip if unparseable
        }
      });
    }

    // 2. Check for placeholders like [Tenant Name] or {{unit}}
    const placeholderRegex = /\[[^\]]+\]|\{\{[^\}]+\}\}/g;
    if (placeholderRegex.test(cleaned)) {
      violations.push('Placeholders detected');
      // Attempt to strip common placeholders if they are not filled
      cleaned = cleaned.replace(placeholderRegex, '');
    }

    // 3. Check for "undefined" or "null" literals as strings
    if (cleaned.toLowerCase().includes('undefined') || cleaned.toLowerCase().includes('null')) {
      violations.push('Technical literals detected (undefined/null)');
      cleaned = cleaned.replace(/undefined|null/gi, '');
    }

    // 4. Final sanity check for empty or broken responses
    if (cleaned.trim().length === 0 && text.trim().length > 0) {
      violations.push('Cleaning resulted in empty response');
    }

    const isValid = violations.length === 0;
    if (!isValid) {
      this.logger.warn(`[ResponseValidator] Violations found in response: ${violations.join(', ')}`);
    }

    return {
      isValid,
      cleanedText: cleaned.trim(),
      violations
    };
  }

  /**
   * Determines if the response should be rejected and re-prompted.
   */
  shouldReprompt(result: ValidationResult): boolean {
    // If it's a critical placeholder or completely empty after cleaning, re-prompt
    return result.violations.includes('Cleaning resulted in empty response') || 
           (result.violations.includes('Placeholders detected') && result.cleanedText.length < 10);
  }
}
