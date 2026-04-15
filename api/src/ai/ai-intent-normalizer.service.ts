import { Injectable, Logger } from '@nestjs/common';

export interface NormalizationHint {
  intentHint: string;
  entities: Record<string, any>;
  urgency: 'NORMAL' | 'HIGH' | 'EMERGENCY';
  language: 'en' | 'sw' | 'mixed';
  recommendedAction?: string;
}

@Injectable()
export class AiIntentNormalizerService {
  private readonly logger = new Logger(AiIntentNormalizerService.name);

  private readonly SWAHILI_MAP: Record<string, string> = {
    'bomba imepasuka': 'EMERGENCY:BURST_PIPE',
    'maji imejaa': 'EMERGENCY:FLOODING',
    bomba: 'MAINTENANCE:PLUMBING',
    maji: 'MAINTENANCE:WATER',
    kelele: 'TENANT_DISPUTE:NOISE',
    kodi: 'FINANCIAL:RENT',
    nimetuma: 'PAYMENT:SENT',
    nimelipa: 'PAYMENT:PAID',
    nimepay: 'PAYMENT:PAID',
    salio: 'FINANCIAL:BALANCE',
    deni: 'FINANCIAL:ARREARS',
    shida: 'ISSUE/PROBLEM',
    umeme: 'MAINTENANCE:ELECTRIC',
    moto: 'EMERGENCY:FIRE',
    gesi: 'EMERGENCY:GAS',
  };

  private readonly UNIT_PATTERN =
    /\b(?:unit|house|nyumba|room|#)\s*([a-z0-9]+)\b/i;
  private readonly AMOUNT_PATTERN =
    /\b(?:ksh|kes|sh)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:k|thousand)?\b/i;

  normalize(message: string): NormalizationHint {
    const text = message.toLowerCase();
    const hints: string[] = [];
    const entities: Record<string, any> = {};
    let urgency: NormalizationHint['urgency'] = 'NORMAL';

    // 1. Language & Intent Mapping
    for (const [sw, hint] of Object.entries(this.SWAHILI_MAP)) {
      if (text.includes(sw)) {
        hints.push(hint);
        if (hint.startsWith('EMERGENCY')) urgency = 'EMERGENCY';
      }
    }

    // 2. Entity Extraction (Regex)
    const unitMatch = text.match(this.UNIT_PATTERN);
    if (unitMatch) {
      entities.unitNumber = unitMatch[1].toUpperCase();
    }

    const amountMatch = text.match(this.AMOUNT_PATTERN);
    if (amountMatch) {
      const val = amountMatch[1].replace(/,/g, '');
      let numericVal = parseFloat(val);
      if (
        text.includes(`${amountMatch[1]}k`) ||
        text.includes(`${amountMatch[1]} k`)
      ) {
        numericVal *= 1000;
      }
      entities.amount = numericVal;
    }

    // 3. Emergency Signals
    if (
      urgency !== 'EMERGENCY' &&
      /\b(urgent|emergency|dharura|haraka|critical|immediately)\b/i.test(text)
    ) {
      urgency = 'HIGH';
    }

    // 4. HARD PATTERN RULES (Deterministic Overrides)
    if (
      /\b(maji|imepotea|hakuna maji|bomba|imepasuka|leaking|leak|water issue)\b/i.test(
        text,
      )
    ) {
      hints.push('MAINTENANCE:REPAIR');
    }
    if (/\brepaint|dirty wall|broken tile|sink issue\b/i.test(text)) {
      hints.push('MAINTENANCE:COSMETIC');
      urgency = 'NORMAL';
    }
    if (
      (text.includes('weka') ||
        text.includes('register') ||
        text.includes('add')) &&
      (this.UNIT_PATTERN.test(text) || /\b[A-Z]\d+\b/i.test(text))
    ) {
      hints.push('ONBOARDING:TENANT');
    }
    // Specific Swahili Onboarding Pattern: "weka [Name] kwa [Unit]"
    if (/weka\s+[\w\s]+\s+kwa\s+[A-Z]\d+/i.test(text)) {
      hints.push('ONBOARDING:TENANT');
    }
    if (/\bhow much|arrears|balance|summary|figure|report|deni\b/i.test(text)) {
      hints.push('FINANCIAL:QUERY');
    }
    if (/\blate on rent|pay on|will pay|kodi\b/i.test(text)) {
      hints.push('LATE_PAYMENT');
    }
    if (/\brone|noise|neighbor|party|loud|disturb\b/i.test(text)) {
      hints.push('TENANT_DISPUTE:NOISE');
    }

    return {
      intentHint: [...new Set(hints)].join(', '),
      entities,
      urgency,
      language: hints.length > 0 ? 'sw' : 'en',
      recommendedAction:
        urgency === 'EMERGENCY' ? 'LOG_MAINTENANCE_IMMEDIATELY' : undefined,
    };
  }
}
