import { Injectable } from '@nestjs/common';
import { WhatsAppFormatterService } from './whatsapp-formatter.service';

@Injectable()
export class MainMenuService {
  constructor(private readonly formatter: WhatsAppFormatterService) {}

  getMainMenu(language: string = 'en') {
    const isSw = language === 'sw';
    
    const title = isSw ? 'Menyu Kuu' : 'Main Menu';
    const body = isSw 
        ? 'Karibu Aedra! Chagua kitendo unachotaka kufanya:' 
        : 'Welcome to Aedra! Choose an action to get started:';
    
    const sections = [
      {
        title: isSw ? 'Usimamizi' : 'Management',
        rows: [
          { id: 'menu_properties', title: isSw ? 'Mali & Majengo' : 'Properties & Buildings', description: isSw ? 'Orodha ya majengo yako' : 'List and manage properties' },
          { id: 'menu_tenants', title: isSw ? 'Wapangaji' : 'Tenants', description: isSw ? 'Simamia wapangaji wako' : 'Manage your tenants' },
          { id: 'menu_units', title: isSw ? 'Units' : 'Units', description: isSw ? 'Hali ya vyumba/units' : 'View unit status' },
        ],
      },
      {
        title: isSw ? 'Fedha & Ripoti' : 'Finance & Reports',
        rows: [
          { id: 'menu_financials', title: isSw ? 'Taarifa za Fedha' : 'Financial Summary', description: isSw ? 'Makusanyo na madeni' : 'Collection & arrears summary' },
          { id: 'menu_reports', title: isSw ? 'Ripoti' : 'Reports', description: isSw ? 'Tengeneza ripoti za PDF' : 'Generate PDF reports' },
        ],
      },
      {
        title: isSw ? 'Msaada' : 'Support',
        rows: [
          { id: 'menu_help', title: isSw ? 'Msaada' : 'Help & Support', description: isSw ? 'Jinsi ya kutumia Aedra' : 'How to use Aedra' },
          { id: 'menu_settings', title: isSw ? 'Mipangilio' : 'Settings', description: isSw ? 'Badili lugha au maelezo' : 'Change language or profile' },
        ],
      }
    ];

    return this.formatter.buildMultiSectionListMessage(body, sections, title, language);
  }

  getUnidentifiedMenu(language: string = 'en') {
    const isSw = language === 'sw';
    const body = isSw 
        ? 'Karibu Aedra! Inaonekana namba yako haijasajiliwa. Je, ungependa kusajili kampuni mpya?' 
        : 'Welcome to Aedra! It seems your number is not registered yet. Would you like to register a new company or talk to support?';

    return {
      type: 'button',
      body: { text: body },
      action: {
        buttons: [
          { type: 'reply', reply: { id: 'auth_register', title: isSw ? 'Sajili Kampuni' : 'Register Company' } },
          { type: 'reply', reply: { id: 'auth_support', title: isSw ? 'Msaada' : 'Talk to Support' } }
        ]
      }
    };
  }
}
