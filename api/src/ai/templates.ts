export interface TemplateData {
  [key: string]: any;
}

/**
 * =====================================================================
 * TEMPLATE REGISTRY
 * All WhatsApp message templates, available in English (EN) & Swahili (SW).
 *
 * Type A: Proactive outreach (Company → User). Must be Meta-approved.
 * Type B: Reactive in-session agent responses (free-text / interactive).
 * Type C: Feedback & satisfaction (post-interaction CSAT/NPS).
 * =====================================================================
 */
export const TEMPLATE_REGISTRY: Record<string, Record<'EN' | 'SW', string>> = {
  // ── Type A: Proactive Outreach ─────────────────────────────────────

  /** Routine monthly rent reminder */
  rent_reminder: {
    EN: 'Hi {{tenantName}}, this is Aedra from management. A quick reminder that KES {{amountDue}} for Unit {{unitNumber}} is due on {{dueDate}}. Please let us know once paid. Thanks!',
    SW: 'Habari {{tenantName}}, huyu ni Aedra kutoka usimamizi. Nakukumbusha kuwa KES {{amountDue}} ya Nyumba {{unitNumber}} inatakiwa kulipwa kufikia {{dueDate}}. Tafadhali tujulishe ukishalipa. Asante!',
  },

  /** Firm reminder for overdue rent (3+ days) */
  rent_reminder_firm: {
    EN: 'Hi {{tenantName}}, we noticed that KES {{amountDue}} for Unit {{unitNumber}} was due on {{dueDate}} and is currently outstanding. Please settle this as soon as possible to avoid penalties. Thanks, Aedra.',
    SW: 'Habari {{tenantName}}, tumeona kuwa KES {{amountDue}} ya Nyumba {{unitNumber}} ilitakiwa kulipwa tarehe {{dueDate}} na bado haijalipwa. Tafadhali lipa haraka iwezekanavyo ili kuepuka faini. Asante, Aedra.',
  },

  /** Payment receipt after successful payment logged */
  payment_receipt: {
    EN: '✅ Payment Received! KES {{amount}} for Unit {{unitNumber}} has been recorded on {{date}}. Your balance is now KES {{newBalance}}. Thank you, {{tenantName}}!',
    SW: '✅ Malipo Yamepokelewa! KES {{amount}} ya Nyumba {{unitNumber}} imerekodiwa tarehe {{date}}. Salio lako sasa ni KES {{newBalance}}. Asante, {{tenantName}}!',
  },

  /** Invoice notification after creation */
  invoice_notice: {
    EN: '📋 New Invoice: A {{description}} of KES {{amount}} for Unit {{unitNumber}} has been generated. Due date: {{dueDate}}. Please settle at your earliest convenience. – Aedra',
    SW: '📋 Risiti Mpya: {{description}} ya KES {{amount}} kwa Nyumba {{unitNumber}} imetengenezwa. Tarehe ya mwisho: {{dueDate}}. Tafadhali lipa ukiweza. – Aedra',
  },

  /** Confirmation that a payment promise was noted */
  payment_promise_ack: {
    EN: "📝 Noted! I've logged your payment promise of KES {{amount}} by {{dueDate}}. I'll send you a reminder a day before. If you need to update this, just message us.",
    SW: '📝 Imetiwa kumbukumbu! Nimerekodi ahadi yako ya kulipa KES {{amount}} ifikapo {{dueDate}}. Nitakutumia ukumbusho siku moja kabla. Ukihitaji kubadilisha, tuma ujumbe.',
  },

  /** Maintenance status change notification */
  maintenance_update: {
    EN: '🔧 Update on Ticket #{{issueId}} "{{title}}": Status is now *{{status}}*. {{updateMessage}} Estimated completion: {{eta}}.',
    SW: '🔧 Taarifa ya Tiketi #{{issueId}} "{{title}}": Hali sasa ni *{{status}}*. {{updateMessage}} Kukamilika kunatarajiwa: {{eta}}.',
  },

  /** Maintenance request resolved */
  maintenance_resolved: {
    EN: '✅ Great news! Ticket #{{issueId}} "{{title}}" has been *resolved*. Please let us know if the issue persists.',
    SW: '✅ Habari njema! Tiketi #{{issueId}} "{{title}}" imetatuliwa. Tafadhali tujulishe tatizo likiendelea.',
  },

  /** 30-day lease expiry notice */
  lease_expiry_notice: {
    EN: '📋 Reminder: Your lease for Unit {{unitNumber}} expires on {{expiryDate}}. Please contact us to discuss renewal or your move-out plan. – Aedra',
    SW: '📋 Ukumbusho: Mkataba wako wa Nyumba {{unitNumber}} unaisha tarehe {{expiryDate}}. Tafadhali wasiliana nasi kujadili upya au mpango wako wa kuondoka. – Aedra',
  },

  /** Financial report ready for landlord */
  landlord_report_ready: {
    EN: '📊 Your {{reportType}} report for {{propertyName}} is ready. You can view it here: {{reportUrl}}',
    SW: '📊 Ripoti yako ya {{reportType}} kwa {{propertyName}} ipo tayari. Unaweza kuiona hapa: {{reportUrl}}',
  },

  /** Welcome message after tenant onboarding */
  welcome_tenant: {
    EN: "👋 Welcome to your new home, {{tenantName}}! I'm Aedra, your AI property assistant. You can reach me anytime for rent balance, maintenance requests, or payment help. Just message this number!",
    SW: '👋 Karibu nyumbani kwako, {{tenantName}}! Mimi ni Aedra, msaidizi wako wa AI wa mali. Unaweza kunipigia wakati wowote kwa salio la kodi, maombi ya matengenezo, au msaada wa malipo. Tuma ujumbe nambari hii!',
  },

  /** Staff notification for a new assigned task */
  staff_new_task: {
    EN: '📌 New task assigned to you: "{{taskTitle}}". Due: {{dueDate}}. Priority: {{priority}}. Open the Aedra dashboard for details.',
    SW: '📌 Kazi mpya imekupewa: "{{taskTitle}}". Mwisho: {{dueDate}}. Kipaumbele: {{priority}}. Fungua dashibodi ya Aedra kwa maelezo.',
  },

  /** Daily tasks summary for staff/admins */
  daily_todo_summary: {
    EN: 'Habari {{name}}, 👋\n\nThis is your to-do list of critical activities for today:\n\n{{taskList}}\n\nPlease login to the portal to manage your tasks.',
    SW: 'Habari {{name}}, 👋\n\nHii ndio orodha yako ya kazi muhimu za leo:\n\n{{taskList}}\n\nTafadhali ingia kwenye mfumo ili kudhibiti kazi zako.',
  },

  // ── Type B: Reactive In-Session Responses ─────────────────────────

  /** Standard greeting when a new session starts */
  greeting: {
    EN: 'Hello! I am Aedra, your virtual property management assistant. How can I help you today?',
    SW: 'Habari! Mimi ni Aedra, msaidizi wako wa kidijitali wa usimamizi wa mali. Naweza kukusaidia vipi leo?',
  },

  /** Help menu listing capabilities */
  help: {
    EN: 'I can help you with:\n• Checking rent balance\n• Recording payments\n• Reporting maintenance issues\n• Finding vacant units\n• Generating property reports\nWhat would you like to do?',
    SW: 'Naweza kukusaidia na:\n• Kuangalia salio la kodi\n• Kurekodi malipo\n• Kuripoti matatizo ya matengenezo\n• Kupata nyumba zilizo wazi\n• Kutengeneza ripoti za mali\nUngependa kufanya nini?',
  },

  /** Phone number not recognized in system */
  unidentified_denial: {
    EN: "I'm sorry, but your phone number is not recognized in our system. I can share vacancies, but access to internal data requires a registered account. Please contact your property manager to get set up.",
    SW: 'Samahani, nambari yako ya simu haitambuliki katika mfumo wetu. Naweza kukuonyesha nyumba zilizo wazi, lakini kupata taarifa za ndani unahitaji akaunti iliyosajiliwa. Tafadhali wasiliana na meneja wako wa mali ili usajiliwe.',
  },

  /** Payment M-Pesa confirmation verified */
  payment_confirmation_success: {
    EN: '✓ Confirmed. I see your payment {{code}} of KES {{amount}} for Unit {{unitNumber}}. A receipt was issued on {{date}}.',
    SW: '✓ Imethibitishwa. Naona malipo yako {{code}} ya KES {{amount}} kwa Nyumba {{unitNumber}}. Risiti ilitolewa tarehe {{date}}.',
  },

  /** Awaiting M-Pesa confirmation */
  payment_confirmation_pending: {
    EN: "I see M-Pesa code {{code}}, but I haven't received the confirmation from M-Pesa yet. It usually takes a minute. I'll notify you once it's processed!",
    SW: 'Naona kodi ya M-Pesa {{code}}, lakini bado sijaipata kutoka kwa M-Pesa. Kawaida huchukua dakika moja. Nitakujulisha ikishapokelewa!',
  },

  /** Ask user to share M-Pesa code */
  payment_code_request: {
    EN: 'Asante! Please share your M-Pesa confirmation code (e.g., SKF1234567) so I can confirm and send your receipt.',
    SW: 'Asante! Tafadhali nishirikishe kodi ya M-Pesa (mfano, SKF1234567) ili nithibitishe na nikutumie risiti yako.',
  },

  /** Company context required for STAFF with multiple companies */
  company_selection_required: {
    EN: 'Please select a company first to proceed with this request.',
    SW: 'Tafadhali chagua kampuni kwanza ili kuendelea na ombi hili.',
  },

  /** Debug / profile info */
  profile_info: {
    EN: 'You are logged in as {{role}}{{companyInfo}}. User ID: {{userId}}',
    SW: 'Umesajiliwa kama {{role}}{{companyInfo}}. Kitambulisho cha Mtumiaji: {{userId}}',
  },

  /** Maintenance logged — used when tool returned clarificationNeeded */
  maintenance_clarification: {
    EN: "I've logged your maintenance request (Ticket #{{issueId}}). To dispatch the right team, could you confirm your unit number?",
    SW: 'Nimerekodi ombi lako la matengenezo (Tiketi #{{issueId}}). Ili nipeleke timu sahihi, unaweza kuthibitisha namba ya nyumba yako?',
  },

  /** Graceful handoff to human agent */
  human_handoff: {
    EN: "I wasn't able to complete this automatically (Reference: {{traceId}}). A team member will follow up with you shortly. Apologies for the inconvenience.",
    SW: 'Sikuweza kukamilisha hili kiatomati (Kumbukumbu: {{traceId}}). Mwanachama wa timu atakuwasiliana nawe hivi karibuni. Samahani kwa usumbufu.',
  },

  // ── Type C: Feedback & Satisfaction ───────────────────────────────

  /** Quick CSAT prompt (thumbs up / down) */
  csat_prompt_tenant: {
    EN: 'How did we do? 😊 Tap below to rate your experience with Aedra.',
    SW: 'Tulifanyaje? 😊 Bonyeza chini ili kutathmini uzoefu wako na Aedra.',
  },

  /** Extended CSAT for longer conversations */
  csat_prompt_extended: {
    EN: 'Thank you for using Aedra! On a scale of 1–5, how satisfied were you with the service today?',
    SW: 'Asante kwa kutumia Aedra! Kwa kipimo cha 1–5, ulikuwa na furaha kiasi gani na huduma ya leo?',
  },

  /** Monthly NPS pulse */
  nps_monthly: {
    EN: 'Hi {{tenantName}}, quick question: how likely are you to recommend Aedra to a friend or neighbour? (1 = Not likely, 5 = Very likely)',
    SW: 'Habari {{tenantName}}, swali moja haraka: una uwezekano gani wa kupendekeza Aedra kwa rafiki au jirani? (1 = Haiwezekani, 5 = Inawezekana sana)',
  },
};

/**
 * =====================================================================
 * TEMPLATE SEND STRATEGY
 * Maps an AI intent → template name + delivery method + post-action CSAT.
 *
 * deliveryMethod:
 *   'text'         - Free-text (within 24h session window)
 *   'template'     - Meta-approved template (works outside 24h window)
 *   'interactive'  - Interactive buttons or list (within 24h session window)
 *   'document'     - Document/PDF attachment
 *
 * postActionCsat: If true, schedule a CSAT prompt 30 minutes after completion.
 * =====================================================================
 */
export interface TemplateSendStrategy {
  deliveryMethod: 'text' | 'template' | 'interactive' | 'document';
  templateName?: string;
  /** Override template for success path */
  successTemplate?: string;
  /** Override template for clarification path */
  clarificationTemplate?: string;
  postActionCsat: boolean;
  csatDelayMs?: number;
}

export const TEMPLATE_SEND_STRATEGY: Record<string, TemplateSendStrategy> = {
  PAYMENT_PROMISE: {
    deliveryMethod: 'template',
    successTemplate: 'payment_promise_ack',
    clarificationTemplate: 'payment_code_request',
    postActionCsat: true,
    csatDelayMs: 30 * 60 * 1000, // 30 minutes
  },
  PAYMENT_DECLARATION: {
    deliveryMethod: 'template',
    successTemplate: 'payment_receipt',
    clarificationTemplate: 'payment_code_request',
    postActionCsat: true,
    csatDelayMs: 30 * 60 * 1000,
  },
  MAINTENANCE: {
    deliveryMethod: 'text',
    clarificationTemplate: 'maintenance_clarification',
    postActionCsat: true,
    csatDelayMs: 4 * 60 * 60 * 1000, // 4 hours (after team has likely responded)
  },
  MAINTENANCE_REQUEST: {
    deliveryMethod: 'text',
    clarificationTemplate: 'maintenance_clarification',
    postActionCsat: true,
    csatDelayMs: 4 * 60 * 60 * 1000,
  },
  EMERGENCY: {
    deliveryMethod: 'text', // Immediate free-text + 🚨 reaction
    postActionCsat: false, // Do NOT interrupt emergencies with CSAT
  },
  FINANCIAL_REPORTING: {
    deliveryMethod: 'document',
    successTemplate: 'landlord_report_ready',
    postActionCsat: true,
    csatDelayMs: 15 * 60 * 1000, // 15 minutes
  },
  REVENUE_REPORT: {
    deliveryMethod: 'document',
    successTemplate: 'landlord_report_ready',
    postActionCsat: true,
    csatDelayMs: 15 * 60 * 1000,
  },
  FINANCIAL_QUERY: {
    deliveryMethod: 'text',
    postActionCsat: false,
  },
  LATE_PAYMENT: {
    deliveryMethod: 'template',
    successTemplate: 'rent_reminder_firm',
    postActionCsat: false,
  },
  ONBOARDING: {
    deliveryMethod: 'text',
    successTemplate: 'welcome_tenant',
    postActionCsat: true,
    csatDelayMs: 60 * 60 * 1000, // 1 hour after onboarding
  },
  GENERAL_QUERY: {
    deliveryMethod: 'text',
    postActionCsat: false,
  },
};

/**
 * Render a template string by substituting {{variable}} placeholders.
 */
export function renderTemplate(
  skillId: string,
  language: 'EN' | 'SW',
  data: TemplateData,
  tone?: string,
): string {
  let key = skillId;
  if (skillId === 'rent_reminder' && tone === 'firm') {
    key = 'rent_reminder_firm';
  }

  const template =
    TEMPLATE_REGISTRY[key]?.[language] ||
    TEMPLATE_REGISTRY[skillId]?.[language];
  if (!template) return '';

  return template.replace(/{{\s*(\w+)\s*}}/g, (_, key) => {
    return data[key] !== undefined ? String(data[key]) : `{{${key}}}`;
  });
}

/**
 * Get the send strategy for a given AI intent.
 */
export function getSendStrategy(intent: string): TemplateSendStrategy {
  return (
    TEMPLATE_SEND_STRATEGY[intent] ?? {
      deliveryMethod: 'text',
      postActionCsat: false,
    }
  );
}
