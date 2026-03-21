import { Injectable } from '@nestjs/common';

export interface VerificationResult {
  passed: boolean;
  unverifiedNumbers: number[];
}

@Injectable()
export class FinancialCrossChecker {
  /**
   * Verifies that all financial figures in the response text can be traced
   * back to specific tool results to prevent hallucinations (BS-08).
   */
  verify(response: string, toolResults: any[]): VerificationResult {
    const responseNumbers = this.extractNumbers(response);
    if (responseNumbers.length === 0) {
      return { passed: true, unverifiedNumbers: [] };
    }

    const sourceNumbers = this.extractSourceNumbers(toolResults);
    const unverifiedNumbers = responseNumbers.filter(
      (rn) => !sourceNumbers.some((sn) => this.isMatch(rn, sn)),
    );

    return {
      passed: unverifiedNumbers.length === 0,
      unverifiedNumbers,
    };
  }

  private extractNumbers(text: string): number[] {
    // Basic number extraction, ignoring small numbers like dates or counts < 100
    // unless they look like percentages
    const matches = text.match(/[\d,.]+/g) || [];
    return matches
      .map((m) => {
        const cleaned = m.replace(/,/g, '');
        const val = parseFloat(cleaned);
        return { val, original: m };
      })
      .filter(
        ({ val, original }) =>
          !isNaN(val) &&
          (val > 100 ||
            (val > 0 && val <= 100 && text.includes(original + '%'))),
      )
      .map((item) => item.val);
  }

  private extractSourceNumbers(results: any[]): number[] {
    const numbers: number[] = [];
    const walk = (obj: any) => {
      if (typeof obj === 'number') {
        numbers.push(obj);
        // Also push percentage equivalent if applicable
        if (obj > 0 && obj <= 1) numbers.push(obj * 100);
      } else if (obj && typeof obj === 'object') {
        Object.values(obj).forEach(walk);
      }
    };
    results.forEach((r) => walk(r.result || r));
    return numbers;
  }

  private isMatch(n1: number, n2: number): boolean {
    // Allow for small rounding differences (1%)
    if (n1 === n2) return true;
    const diff = Math.abs(n1 - n2);
    const avg = (n1 + n2) / 2;
    return diff / avg < 0.01;
  }
}
