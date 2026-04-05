import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ErrorRecoveryService {
  private readonly logger = new Logger(ErrorRecoveryService.name);

  private readonly RECOVERY_MESSAGES = {
    generate_report: {
      en: `Apologies — I couldn't generate the report right now.\nThis is usually temporary. What would you like to do?\n\n1. Try again\n2. Generate for a specific property instead\n3. Come back later`,
      sw: `Samahani — sikuweza kutengeneza ripoti sasa hivi.\nHii kawaida ni ya muda. Ungependa nini?\n\n1. Jaribu tena\n2. Tengeneza kwa mali maalum\n3. Rudi baadaye`,
    },
    generate_mckinsey_report: {
      en: `Apologies — I couldn't generate the McKinsey report. This usually happens with large date ranges or complex calculations.\n\n1. Retry report\n2. Try a shorter date range\n3. Show main menu`,
      sw: `Samahani — sikuweza kutengeneza ripoti ya McKinsey. Hii mara nyingi hutokea kwa vipindi virefu au mahesabu magumu.\n\n1. Jaribu tena\n2. Jaribu kipindi kifupi zaidi\n3. Onyesha menyu kuu`,
    },
    select_company: {
      en: `Couldn't switch companies right now. Try again or type the company name directly.\n\n1. Retry selection\n2. List all companies`,
      sw: `Sikuweza kubadilisha kampuni sasa hivi. Jaribu tena au andika jina la kampuni moja kwa moja.\n\n1. Jaribu tena\n2. Onyesha kampuni zote`,
    },
    get_payment_details: {
      en: `I couldn't retrieve those payment details right now. Please check the ID or try again later.\n\n1. Retry request\n2. List recent payments`,
      sw: `Sikuweza kupata maelezo ya malipo hayo sasa hivi. Tafadhali kagua ID au jaribu tena baadaye.\n\n1. Jaribu tena\n2. Onyesha malipo ya hivi karibuni`,
    },
    default: {
      en: `Something went wrong. Please try again or type your request differently.\n\n1. Try again\n2. Show main menu`,
      sw: `Kuna tatizo. Tafadhali jaribu tena au andika ombi lako tofauti.\n\n1. Jaribu tena\n2. Onyesha menyu kuu`,
    },
  };

  buildErrorRecovery(
    action: string,
    error: Error | any,
    context: { userId?: string },
    language: 'en' | 'sw' = 'en',
  ): string {
    const errorMsg =
      error?.message || (typeof error === 'string' ? error : 'Unknown error');
    const maskedUserId = context.userId
      ? `${context.userId.substring(0, 4)}...${context.userId.substring(context.userId.length - 4)}`
      : 'anon';

    this.logger.error(`Action ${action} failed: ${errorMsg}`, error?.stack || 'No stack trace', {
      userId: maskedUserId,
      action,
    });

    if (
      errorMsg.includes('429') ||
      errorMsg.toLowerCase().includes('resource exhausted') ||
      errorMsg.toLowerCase().includes('fetch failed') ||
      errorMsg.toLowerCase().includes('timeout')
    ) {
      return language === 'sw'
        ? `Huduma ya AI ina shughuli nyingi sana sasa hivi (Rate Limit). Tafadhali jaribu tena baada ya dakika moja.\n\n1. Jaribu tena sasa\n2. Rudi baadaye`
        : `The AI service is currently very busy (Rate Limit). Please try again in a minute.\n\n1. Try again now\n2. Come back later`;
    }

    if (errorMsg.includes('not implemented')) {
      return language === 'sw'
        ? `Samahani, kipengele hiki kinasasishwa na hakipatikani kwa sasa.\n\n1. Jaribu kitendo kingine\n2. Rudi menyu kuu`
        : `Apologies, this feature is currently being updated and is temporarily unavailable.\n\n1. Try another action\n2. Back to main menu`;
    }

    if (errorMsg.includes('select a company workspace first')) {
      return language === 'sw'
        ? `Kufanya hivyo, unahitaji kuchagua kampuni kwanza.\n\n1. Onyesha kampuni zote\n2. Rudi menyu kuu`
        : `To do that, you need to select a company first.\n\n1. Show company list\n2. Back to main menu`;
    }

    const messages =
      (this.RECOVERY_MESSAGES as any)[action] || this.RECOVERY_MESSAGES.default;
    return messages[language] || messages.en;
  }

  buildInteractiveErrorRecovery(
    action: string,
    error: Error,
    context: { userId?: string },
    language: 'en' | 'sw' = 'en',
  ): {
    text: string;
    options: { key: string; label: string; action: string }[];
    errorId: string;
  } {
    const text = this.buildErrorRecovery(action, error, context, language);
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const options = [
      {
        key: 'fail_reason',
        label: language === 'sw' ? 'Kwa nini imefeli?' : 'Why did it fail?',
        action: `fail_reason:${errorId}`,
      },
    ];

    return { text, options, errorId };
  }
}
