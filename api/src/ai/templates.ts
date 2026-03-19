export interface TemplateData {
    [key: string]: any;
}

export const TEMPLATE_REGISTRY: Record<string, Record<'EN' | 'SW', string>> = {
    rent_reminder: {
        EN: 'Hi {{tenantName}}, this is Aedra from management. A quick reminder that KES {{amountDue}} for Unit {{unitNumber}} is due on {{dueDate}}. Please let us know once paid. Thanks!',
        SW: 'Habari {{tenantName}}, huyu ni Aedra kutoka usimamizi. Nakukumbusha kuwa KES {{amountDue}} ya Nyumba {{unitNumber}} inatakiwa kulipwa kufikia {{dueDate}}. Tafadhali tujulishe ukishalipa. Asante!'
    },
    rent_reminder_firm: {
        EN: 'Hi {{tenantName}}, we noticed that KES {{amountDue}} for Unit {{unitNumber}} was due on {{dueDate}} and is currently outstanding. Please settle this as soon as possible to avoid penalties. Thanks, Aedra.',
        SW: 'Habari {{tenantName}}, tumeona kuwa KES {{amountDue}} ya Nyumba {{unitNumber}} ilitakiwa kulipwa tarehe {{dueDate}} na bado haijalipwa. Tafadhali lipa haraka iwezekanavyo ili kuepuka faini. Asante, Aedra.'
    },
    maintenance_status: {
        EN: 'Update on "{{title}}": The status is currently {{status}}. {{update}}. Next: {{nextStep}}.',
        SW: 'Taarifa kuhusu "{{title}}": Hali kwa sasa ni {{status}}. {{update}}. Hatua inayofuata: {{nextStep}}.'
    },
    greeting: {
        EN: 'Hello! I am Aedra, your virtual property management assistant. How can I help you today?',
        SW: 'Habari! Mimi ni Aedra, msaidizi wako wa kidijitali wa usimamizi wa mali. Naweza kukusaidia vipi leo?'
    },
    help: {
        EN: 'I can help you with:\n• Checking rent balance\n• Recording payments\n• Reporting maintenance issues\n• Finding vacant units\n• Generating property reports\nWhat would you like to do?',
        SW: 'Naweza kukusaidia na:\n• Kuangalia salio la kodi\n• Kurekodi malipo\n• Kuripoti matatizo ya matengenezo\n• Kupata nyumba zilizo wazi\n• Kutengeneza ripoti za mali\nUngependa kufanya nini?'
    },
    unidentified_denial: {
        EN: 'I\'m sorry, but your phone number is not recognized in our system. I can share vacancies, but access to internal data requires a registered account. Please contact your property manager to get set up.',
        SW: 'Samahani, nambari yako ya simu haitambuliki katika mfumo wetu. Naweza kukuonyesha nyumba zilizo wazi, lakini kupata taarifa za ndani unahitaji akaunti iliyosajiliwa. Tafadhali wasiliana na meneja wako wa mali ili usajiliwe.'
    },
    company_selection_required: {
        EN: 'Please select a company first to proceed with this request.',
        SW: 'Tafadhali chagua kampuni kwanza ili kuendelea na ombi hili.'
    },
    payment_confirmation_success: {
        EN: '✓ Confirmed. I see your payment {{code}} of KES {{amount}} for Unit {{unitNumber}}. A receipt was issued on {{date}}.',
        SW: '✓ Imethibitishwa. Naona malipo yako {{code}} ya KES {{amount}} kwa Nyumba {{unitNumber}}. Risiti ilitolewa tarehe {{date}}.'
    },
    payment_confirmation_pending: {
        EN: 'I see M-Pesa code {{code}}, but I haven\'t received the confirmation from M-Pesa yet. It usually takes a minute. I\'ll notify you once it\'s processed!',
        SW: 'Naona kodi ya M-Pesa {{code}}, lakini bado sijaipata kutoka kwa M-Pesa. Kawaida huchukua dakika moja. Nitakujulisha ikishapokelewa!'
    },
    payment_code_request: {
        EN: 'Asante! Please share your M-Pesa confirmation code (e.g., SKF1234567) so I can confirm and send your receipt.',
        SW: 'Asante! Tafadhali nishirikishe kodi ya M-Pesa (mfano, SKF1234567) ili nithibitishe na nikutumie risiti yako.'
    },
    profile_info: {
        EN: 'You are logged in as {{role}}{{companyInfo}}. User ID: {{userId}}',
        SW: 'Umesajiliwa kama {{role}}{{companyInfo}}. Kitambulisho cha Mtumiaji: {{userId}}'
    }
};

export function renderTemplate(skillId: string, language: 'EN' | 'SW', data: TemplateData, tone?: string): string {
    let key = skillId;
    if (skillId === 'rent_reminder' && tone === 'firm') {
        key = 'rent_reminder_firm';
    }
    
    const template = TEMPLATE_REGISTRY[key]?.[language] || TEMPLATE_REGISTRY[skillId]?.[language];
    if (!template) return '';

    return template.replace(/{{(\w+)}}/g, (_, key) => {
        return data[key] !== undefined ? String(data[key]) : `{{${key}}}`;
    });
}
