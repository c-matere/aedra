import { Injectable } from '@nestjs/common';

export interface EmergencyCheckResult {
  isEmergency: boolean;
  stopAutomatedFlow: boolean;
  agentPhoneIncluded: boolean;
}

@Injectable()
export class EmergencyEscalationService {
  private readonly ESCALATION_KEYWORDS = [
    'fire',
    'moto',
    'flood',
    'mafuriko',
    'collapse',
    'gesi',
    'gas',
    'umeme',
    'electrocution',
    'damu',
    'blood',
    'msaada',
    'help me',
    'emergency',
    'accident',
    'injured',
    'hurt',
  ];

  checkForEmergency(message: string): EmergencyCheckResult {
    const normalized = message.toLowerCase();
    const isEmergency = this.ESCALATION_KEYWORDS.some((k) =>
      normalized.includes(k),
    );

    return {
      isEmergency,
      stopAutomatedFlow: isEmergency,
      agentPhoneIncluded: isEmergency,
    };
  }

  buildEscalationResponse(
    result: Partial<EmergencyCheckResult>,
    config: { agentPhone: string; language: string },
  ): { message: string } {
    const { agentPhone, language } = config;
    const message =
      language === 'sw'
        ? `⚠️ DHARURA IMETAMBULIWA. Tafadhali piga simu namba hii ya dharura mara moja: ${agentPhone}. Aedra imesitisha usindikaji wa ujumbe huu kwa usalama wako.`
        : `⚠️ EMERGENCY DETECTED. Please call our emergency line immediately: ${agentPhone}. Aedra has suspended automated processing for your safety.`;

    return { message };
  }
}
