import { Injectable } from '@nestjs/common';
import { WhatsAppFormatterService } from './whatsapp-formatter.service';

@Injectable()
export class MainMenuService {
  constructor(private readonly formatter: WhatsAppFormatterService) {}

  getMainMenu(role: string, language: string = 'en', context: any = {}) {
    const isSw = language === 'sw';
    const title = isSw ? 'Menyu Kuu' : 'Main Menu';
    const name = context.userName || 'User';

    let body = isSw
      ? `Karibu Aedra, ${name}! Chagua kitendo unachotaka kufanya:`
      : `Welcome to Aedra, ${name}! Choose an action to get started:`;

    let sections: any[] = [];

    switch (role) {
      case 'SUPER_ADMIN':
        sections = [
          {
            title: isSw ? 'Usimamizi wa Mfumo' : 'Platform Management',
            rows: [
              {
                id: 'menu_companies',
                title: isSw ? 'Majina ya Kampuni' : 'List Companies',
                description: isSw
                  ? 'Angalia kampuni zote'
                  : 'View all registered companies',
              },
              {
                id: 'menu_system_health',
                title: isSw ? 'Hali ya Mfumo' : 'System Health',
                description: isSw
                  ? 'Angalia hali ya afya ya mfumo'
                  : 'Check platform health status',
              },
              {
                id: 'menu_platform_report',
                title: isSw ? 'Ripoti ya Jukwaa' : 'Platform Report',
                description: isSw
                  ? 'Tengeneza ripoti ya jukwaa'
                  : 'Generate global platform report',
              },
            ],
          },
        ];
        break;

      case 'TENANT':
        const balance = context.balanceDue || 0;
        body = isSw
          ? `Habari ${name}! Salio lako: KES ${balance.toLocaleString()}. Ungependa kufanya nini?`
          : `Hi ${name}! Your balance: KES ${balance.toLocaleString()}. What would you like to do?`;
        sections = [
          {
            title: isSw ? 'Akaunti Yangu' : 'My Account',
            rows: [
              {
                id: 'menu_tenant_balance',
                title: isSw ? 'Angalia Salio' : 'Check Balance',
                description: isSw
                  ? 'Angalia deni lako'
                  : 'View your current balance',
              },
              {
                id: 'menu_tenant_receipt',
                title: isSw ? 'Omba Risiti' : 'Request Receipt',
                description: isSw
                  ? 'Pata risiti ya hivi karibuni'
                  : 'Get your latest payment receipt',
              },
              {
                id: 'menu_tenant_statement',
                title: isSw ? 'Taarifa ya Malipo' : 'Payment Statement',
                description: isSw
                  ? 'Omba taarifa ya malipo (PDF)'
                  : 'Request your payment history report',
              },
            ],
          },
          {
            title: isSw ? 'Huduma' : 'Services',
            rows: [
              {
                id: 'menu_tenant_maintenance',
                title: isSw ? 'Ripoti Tatizo' : 'Report Issue',
                description: isSw
                  ? 'Ripoti tatizo la nyumba'
                  : 'Report a maintenance problem',
              },
            ],
          },
        ];
        break;

      case 'LANDLORD':
        const rate = context.collectionRate || 0;
        body = isSw
          ? `Habari ${name}! Ukusanyaji: ${rate}% mwezi huu. Portfolio yako:`
          : `Hi ${name}! Collection rate: ${rate}% this month. Your portfolio overview:`;
        sections = [
          {
            title: isSw ? 'Portfolio Yangu' : 'My Portfolio',
            rows: [
              {
                id: 'menu_landlord_status',
                title: isSw ? 'Hali ya Makusanyo' : 'Collection Status',
                description: isSw
                  ? 'Angalia makusanyo ya mwezi'
                  : 'Check monthly collection status',
              },
              {
                id: 'menu_landlord_vacancies',
                title: isSw ? 'Angalia Nafasi' : 'Check Vacancies',
                description: isSw
                  ? 'Units zilizo wazi'
                  : 'View vacant units across buildings',
              },
              {
                id: 'menu_landlord_report',
                title: isSw ? 'Ripoti ya Portfolio' : 'Portfolio Report',
                description: isSw
                  ? 'Omba ripoti kamili ya PDF'
                  : 'Request a comprehensive PDF report',
              },
            ],
          },
          {
            title: isSw ? 'Mawasiliano' : 'Contact',
            rows: [
              {
                id: 'menu_landlord_agent',
                title: isSw ? 'Wasiliana na Wakala' : 'Contact Agent',
                description: isSw
                  ? 'Ongea na meneja wa majengo'
                  : 'Message the managing agent',
              },
            ],
          },
        ];
        break;

      case 'COMPANY_ADMIN':
      case 'COMPANY_STAFF':
      default:
        sections = [
          {
            title: isSw ? 'Usimamizi' : 'Management',
            rows: [
              {
                id: 'menu_properties',
                title: isSw ? 'Mali & Majengo' : 'Properties',
                description: isSw
                  ? 'Majina ya majengo yako'
                  : 'List and manage properties',
              },
              {
                id: 'menu_tenants',
                title: isSw ? 'Wapangaji' : 'Tenants',
                description: isSw
                  ? 'Simamia wapangaji wako'
                  : 'Manage your tenants',
              },
              {
                id: 'menu_units',
                title: isSw ? 'Units/Vyumba' : 'Units',
                description: isSw
                  ? 'Hali ya vyumba hivi sasa'
                  : 'View current unit availability',
              },
            ],
          },
          {
            title: isSw ? 'Fedha & Ripoti' : 'Finance & Reports',
            rows: [
              {
                id: 'menu_financials',
                title: isSw ? 'Taarifa za Fedha' : 'Financials',
                description: isSw
                  ? 'Makusanyo na madeni'
                  : 'Collection & arrears summary',
              },
              {
                id: 'menu_reports',
                title: isSw ? 'Ripoti' : 'Generate Reports',
                description: isSw
                  ? 'Pata ripoti za PDF haraka'
                  : 'Export PDF reports immediately',
              },
            ],
          },
        ];
        break;
    }

    // Common Footer Sections
    sections.push({
      title: isSw ? 'Msaada' : 'Support',
      rows: [
        {
          id: 'menu_help',
          title: isSw ? 'Msaada / Help' : 'Help & Support',
          description: isSw
            ? 'Jinsi ya kutumia Aedra'
            : 'Learn how to use Aedra effectively',
        },
        {
          id: 'menu_settings',
          title: isSw ? 'Mipangilio' : 'Settings',
          description: isSw
            ? 'Lugha na Wasifu'
            : 'Manage language & your profile',
        },
      ],
    });

    return this.formatter.buildMultiSectionListMessage(
      body,
      sections,
      title,
      language,
    );
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
          {
            type: 'reply',
            reply: {
              id: 'auth_register',
              title: isSw ? 'Sajili Kampuni' : 'Register Company',
            },
          },
          {
            type: 'reply',
            reply: {
              id: 'auth_support',
              title: isSw ? 'Msaada' : 'Talk to Support',
            },
          },
        ],
      },
    };
  }
}
