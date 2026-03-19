import { Injectable } from '@nestjs/common';

export interface ReceiptInput {
  tenantName: string;
  unit: string;
  property?: string;
  amount: number;
  expectedAmount?: number;
  mpesaCode: string;
  paymentDate: string;
  month: string;
  agentName?: string;
  language?: 'en' | 'sw';
}

@Injectable()
export class ReceiptService {
  /**
   * Generates a text-based receipt formatted for WhatsApp delivery.
   */
  generate(input: ReceiptInput): string {
    const lang = input.language || 'en';
    const isSw = lang === 'sw';
    
    const formattedAmount = new Intl.NumberFormat('en-KE').format(input.amount);
    const shortfall = (input.expectedAmount || 0) - input.amount;
    const hasShortfall = shortfall > 0;
    const formattedShortfall = new Intl.NumberFormat('en-KE').format(shortfall);

    let receipt = '';

    if (isSw) {
      receipt = `📄 *RISITI YA MALIPO* 📄\n\n` +
                `Mteja: ${this.maskSensitive(input.tenantName)}\n` +
                `Kitengo: ${input.unit}\n` +
                (input.property ? `Mali: ${input.property}\n` : '') +
                `Mwezi: ${input.month}\n\n` +
                `Kiasi: KES ${formattedAmount}\n` +
                `Kodi ya M-Pesa: ${input.mpesaCode}\n` +
                `Tarehe: ${input.paymentDate}\n\n`;

      if (hasShortfall) {
        receipt += `⚠️ *ANGALIZO*: Kuna baki ya KES ${formattedShortfall} kwa mwezi huu.\n\n`;
      }

      receipt += `Asante kwa malipo yako.\n`;
      if (input.agentName) receipt += `Imetolewa na: ${input.agentName}`;
    } else {
      receipt = `📄 *PAYMENT RECEIPT* 📄\n\n` +
                `Tenant: ${this.maskSensitive(input.tenantName)}\n` +
                `Unit: ${input.unit}\n` +
                (input.property ? `Property: ${input.property}\n` : '') +
                `Month: ${input.month}\n\n` +
                `Amount: KES ${formattedAmount}\n` +
                `M-Pesa Code: ${input.mpesaCode}\n` +
                `Date: ${input.paymentDate}\n\n`;

      if (hasShortfall) {
        receipt += `⚠️ *WARNING*: Outstanding balance of KES ${formattedShortfall} for this month.\n\n`;
      }

      receipt += `Thank you for your payment.\n`;
      if (input.agentName) receipt += `Issued by: ${input.agentName}`;
    }

    return receipt.trim();
  }

  private maskSensitive(text: string): string {
    // Basic privacy: Ensure no phone numbers or emails accidentally included in names
    return text.replace(/\+?\d{9,12}/g, '[MASKED]');
  }
}
