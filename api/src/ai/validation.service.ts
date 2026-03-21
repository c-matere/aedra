import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);

  /**
   * Gap 5: Output Schema Validation
   * Ensures structured JSON matches the AedraSkill outputSchema.
   */
  validateSchema(
    schema: any,
    data: any,
  ): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (schema.type === 'object' && schema.properties) {
      if (typeof data !== 'object' || data === null) {
        errors.push('Data must be an object');
      } else {
        if (schema.required) {
          for (const req of schema.required) {
            if (!(req in data)) {
              errors.push(`Missing required field: ${req}`);
            }
          }
        }

        for (const [key, propSchema] of Object.entries(
          schema.properties as Record<string, any>,
        )) {
          if (key in data) {
            const val = data[key];
            const expectedType = propSchema.type;
            if (expectedType === 'number' && typeof val !== 'number') {
              errors.push(`Field ${key} must be a number`);
            } else if (expectedType === 'string' && typeof val !== 'string') {
              errors.push(`Field ${key} must be a string`);
            } else if (expectedType === 'array' && !Array.isArray(val)) {
              errors.push(`Field ${key} must be an array`);
            }
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Gap 3: Financial Cross-check
   * Ensures any numerical figure in the assistant response exists in tool results.
   * Prevents financial hallucinations.
   */
  crossCheckFinancials(
    responseText: string,
    toolResults: any[],
  ): { consistent: boolean; hallucinations: number[] } {
    const responseNumbers = this.extractNumbers(responseText);
    const toolNumbers = new Set(this.extractNumbersFromObject(toolResults));

    // Allow some common small numbers (0, 1, 100 etc if they are not specifically amounts)
    // But for aedra, we should be strict.
    const hallucinations = responseNumbers.filter(
      (n) => !toolNumbers.has(n) && n > 10,
    ); // Simple heuristic: skip small indices/zeros

    return {
      consistent: hallucinations.length === 0,
      hallucinations,
    };
  }

  private extractNumbers(text: string): number[] {
    // Matches numbers with commas or dots
    const matches = text.match(/\d+(?:,\d{3})*(?:\.\d+)?/g);
    if (!matches) return [];
    return matches.map((m) => Number(m.replace(/,/g, '')));
  }

  private extractNumbersFromObject(obj: any): number[] {
    const numbers: number[] = [];
    const recurse = (item: any) => {
      if (typeof item === 'number') {
        numbers.push(item);
      } else if (typeof item === 'string') {
        // Some tool results might return numbers as strings (e.g. from IDs)
        // We only care about things that look like currency or amounts
        if (/^\d+(\.\d+)?$/.test(item)) {
          numbers.push(Number(item));
        }
      } else if (Array.isArray(item)) {
        item.forEach(recurse);
      } else if (item && typeof item === 'object') {
        Object.values(item).forEach(recurse);
      }
    };
    recurse(obj);
    return numbers;
  }
}
