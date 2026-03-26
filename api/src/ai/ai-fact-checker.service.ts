import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AiFactCheckerService {
  private readonly logger = new Logger(AiFactCheckerService.name);
  /**
   * Cross-references all numbers and key entities in the summary against the tool results.
   * Returns a list of discrepancies.
   */
  async verify(summary: string, results: any[]): Promise<{ isValid: boolean; discrepancies: string[] }> {
    const discrepancies: string[] = [];

    // 1. Extract all numbers and capitalized names/entities from the summary
    const summaryNumbers = this.extractNumbers(summary);
    const summaryEntities = this.extractEntities(summary);
    if (summaryNumbers.length === 0 && summaryEntities.length === 0) return { isValid: true, discrepancies: [] };

    // 2. Extract all numbers and strings from the tool results
    const toolNumbers = this.extractNumbersFromJson(results);
    const toolStrings = this.extractStringsFromJson(results).map(s => s.toLowerCase());

    // 3. Compare summary numbers
    for (const num of summaryNumbers) {
      if (this.isCommonNumber(num)) continue;
      const isGrounded = toolNumbers.some(tn => Math.abs(tn - num) < 0.01);
      if (!isGrounded) discrepancies.push(`Number '${num}' found in response but not in any tool result.`);
    }

    // 4. Compare summary entities (Names)
    const personaIgnoreList = [
      'Friday', 'March', 'April', 'Tenant', 'Unit', 'KES', 'I', 'Aedra', 
      'Karibu', 'Hujambo', 'Sawa', 'Habari', 'Sheng', 'Swahili', 'Kenya', 
      'Mombasa', 'Palm', 'Grove', 'TENANT', 'STAFF', 'LANDLORD', 'NONE', 'PENDING'
    ];

    for (const entity of summaryEntities) {
      if (personaIgnoreList.includes(entity)) continue;
      if (entity.length < 3) continue;
      
      const isGrounded = toolStrings.some(ts => ts.includes(entity.toLowerCase()) || entity.toLowerCase().includes(ts));
      if (!isGrounded) {
        // Only flag if it's definitely not a persona-related or common-structural word
        this.logger.warn(`[FactChecker] Entity '${entity}' mentioned but not grounded. Discrepancy logged.`);
        discrepancies.push(`Entity '${entity}' mentioned but not found in verified tool data.`);
      }
    }

    return {
      isValid: discrepancies.length === 0,
      discrepancies,
    };
  }

  private extractNumbers(text: string): number[] {
    const matches = text.replace(/,/g, '').match(/-?\d+(\.\d+)?/g);
    return matches ? matches.map(m => parseFloat(m)) : [];
  }

  private extractEntities(text: string): string[] {
    // Matches Capitalized words (potential names)
    const matches = text.match(/[A-Z][a-z]+/g);
    return matches ? Array.from(new Set(matches)) : [];
  }

  private extractNumbersFromJson(obj: any): number[] {
    const numbers: number[] = [];
    const recurse = (item: any) => {
      if (typeof item === 'number') {
        numbers.push(item);
      } else if (Array.isArray(item)) {
        item.forEach(recurse);
      } else if (typeof item === 'object' && item !== null) {
        Object.values(item).forEach(recurse);
      } else if (typeof item === 'string') {
        const matches = item.replace(/,/g, '').match(/-?\d+(\.\d+)?/g);
        if (matches) {
          matches.forEach(m => numbers.push(parseFloat(m)));
        }
      }
    };
    recurse(obj);
    return numbers;
  }

  private extractStringsFromJson(obj: any): string[] {
    const strings: string[] = [];
    const recurse = (item: any) => {
      if (typeof item === 'string') {
        strings.push(item);
      } else if (Array.isArray(item)) {
        item.forEach(recurse);
      } else if (typeof item === 'object' && item !== null) {
        Object.values(item).forEach(recurse);
      }
    };
    recurse(obj);
    return strings;
  }

  private isCommonNumber(num: number): boolean {
    const common = [0, 1, 2, 3, 4, 5, 2024, 2025, 2026];
    return common.includes(num) || (num > 0 && num < 10);
  }
}
