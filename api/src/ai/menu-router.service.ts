import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { WhatsAppFormatterService } from './whatsapp-formatter.service';
import { MainMenuService } from './main-menu.service';

type MenuSelectionType = 'company';

interface MenuSessionState {
  userId: string;
  activeCompanyId?: string;
  awaitingSelection?: MenuSelectionType;
  lastResults?: { id: string; name: string; type: string }[];
}

export interface MenuRouteResult {
  handled: boolean;
  tool?: { name: string; args?: any };
  response?: string;
}

@Injectable()
export class MenuRouterService {
  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: any,
    private readonly formatter: WhatsAppFormatterService,
    private readonly mainMenu: MainMenuService,
  ) {}

  private sessionKey(uid: string) {
    return `ai_session:${uid}`;
  }

  private async loadSession(uid: string): Promise<MenuSessionState> {
    const key = this.sessionKey(uid);
    const cached = await this.cacheManager.get(key);
    if (!cached) {
      return { userId: uid };
    }
    return { ...cached, userId: uid };
  }

  private async saveSession(uid: string, session: Partial<MenuSessionState>) {
    const key = this.sessionKey(uid);
    const existing = await this.loadSession(uid);
    const merged = { ...existing, ...session };
    await this.cacheManager.set(key, merged, 3600 * 1000); // 1 hour
    return merged;
  }

  async setCompanyMenu(uid: string, companies: { id: string; name: string }[]) {
    if (!uid || companies.length === 0) return;
    const entries = companies.map((c) => ({
      id: c.id,
      name: c.name,
      type: 'company',
    }));
    await this.saveSession(uid, {
      awaitingSelection: 'company',
      lastResults: entries,
    });
  }

  private renderCompanyDisambiguation(
    companies: { id: string; name: string }[],
    language: string,
    header?: string,
  ) {
    const isSw = language === 'sw';
    const body =
      header || (isSw ? 'Chagua kampuni:' : 'Please select a company:');

    return this.formatter.buildListMessage(
      body,
      isSw ? 'Kampuni' : 'Companies',
      companies.map((c) => ({
        id: c.id,
        title: c.name,
        description: `ID: ${c.id.slice(-4)}`,
      })),
      language,
    );
  }

  private extractSelectionIndex(text: string): number | null {
    const normalized = text.toLowerCase().trim();
    // Support: "4", "4.", "4?", "no 4", "number 4", "option 4"
    const match = normalized.match(
      /(?:^|\b)(?:no\.?|number|option)?\s*(\d{1,2})(?:\b|$)/,
    );
    if (!match) return null;
    const n = parseInt(match[1], 10);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  }

  private extractCompanyNameCandidate(text: string): string | null {
    let normalized = text.toLowerCase().trim();
    normalized = normalized.replace(/[?!.]/g, ' ').replace(/\s+/g, ' ').trim();

    // Remove common verbs/prefixes: "select alphask", "switch to alphask", "choose company alphask"
    normalized = normalized.replace(
      /^(please\s+|kindly\s+)?(select|choose|pick|switch|use|set)\s+(to\s+)?(company|workspace)?\s*/i,
      '',
    );
    normalized = normalized.replace(/^(company|workspace)\s*/i, '');
    normalized = normalized.replace(/\s*(,|;|:)\s*/g, ' ').trim();

    // Remove trailing filler like ", no 4" if present
    normalized = normalized
      .replace(/\b(no\.?|number|option)\s*\d{1,2}\b/i, '')
      .trim();
    return normalized.length >= 2 ? normalized : null;
  }

  async routeMessage(
    uid: string,
    message?: string,
    language: string = 'en',
  ): Promise<MenuRouteResult> {
    if (!message) return { handled: false };
    const text = message.trim();

    // Handle Main Menu selections (Ids starting with menu_)
    if (text.startsWith('menu_')) {
      return this.handleMainMenuSelection(text, language);
    }

    // Handle Auth selections (Ids starting with auth_)
    if (text.startsWith('auth_')) {
      return this.handleAuthSelection(text, language);
    }

    const session = await this.loadSession(uid);
    if (session.awaitingSelection !== 'company') return { handled: false };

    const index1 = this.extractSelectionIndex(text);
    if (index1) {
      const selected = session.lastResults?.[index1 - 1];
      if (!selected) {
        return {
          handled: true,
          response: this.renderCompanyDisambiguation(
            (session.lastResults || []).map((r) => ({
              id: r.id,
              name: r.name,
            })),
            language,
            language === 'sw'
              ? 'Sikuweza kupata chaguo hilo. Tafadhali chagua tena:'
              : "I couldn't find that option. Please choose again:",
          ),
        };
      }
      await this.saveSession(uid, {
        activeCompanyId: selected.id,
        awaitingSelection: undefined,
      });
      const successMsg =
        language === 'sw'
          ? `✅ Umehamia ${selected.name}.`
          : `✅ Switched to ${selected.name}.`;
      return {
        handled: true,
        tool: { name: 'select_company', args: { companyId: selected.id } },
        response: successMsg,
      };
    }

    // Handle direct UUID list_reply for known entities
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        text,
      );
    if (isUuid) {
      const selected = session.lastResults?.find((r) => r.id === text);
      if (selected) {
        if (selected.type === 'company') {
          await this.saveSession(uid, {
            activeCompanyId: selected.id,
            awaitingSelection: undefined,
          });
          return {
            handled: true,
            tool: { name: 'select_company', args: { companyId: selected.id } },
            response:
              language === 'sw'
                ? `✅ Umehamia ${selected.name}.`
                : `✅ Switched to ${selected.name}.`,
          };
        } else if (selected.type === 'property') {
          return {
            handled: true,
            tool: {
              name: 'get_property_details',
              args: { propertyId: selected.id },
            },
          };
        } else if (selected.type === 'tenant') {
          return {
            handled: true,
            tool: {
              name: 'get_tenant_details',
              args: { tenantId: selected.id },
            },
          };
        } else if (selected.type === 'unit') {
          return {
            handled: true,
            tool: { name: 'get_unit_details', args: { unitId: selected.id } },
          };
        }
      }
    }

    const candidate = this.extractCompanyNameCandidate(text);
    if (!candidate) {
      // Keep the user inside the menu loop if they send "?" / random text.
      return {
        handled: true,
        response: this.renderCompanyDisambiguation(
          (session.lastResults || []).map((r) => ({ id: r.id, name: r.name })),
          language,
          language === 'sw'
            ? 'Chagua kampuni kwa nambari kutoka kwenye orodha:'
            : 'Choose a company by replying with a number from the list:',
        ),
      };
    }

    const results = (session.lastResults || []).filter(
      (r) => r.type === 'company',
    );
    const matches = results.filter((r) =>
      r.name.toLowerCase().includes(candidate),
    );

    if (matches.length === 1) {
      const selected = matches[0];
      await this.saveSession(uid, {
        activeCompanyId: selected.id,
        awaitingSelection: undefined,
      });
      const successMsg =
        language === 'sw'
          ? `✅ Umehamia ${selected.name}.`
          : `✅ Switched to ${selected.name}.`;
      return {
        handled: true,
        tool: { name: 'select_company', args: { companyId: selected.id } },
        response: successMsg,
      };
    }

    if (matches.length > 1) {
      // Disambiguate and keep waiting for a digit.
      await this.saveSession(uid, {
        awaitingSelection: 'company',
        lastResults: matches.map((m) => ({
          id: m.id,
          name: m.name,
          type: 'company',
        })),
      });
      return {
        handled: true,
        response: this.renderCompanyDisambiguation(
          matches.map((m) => ({ id: m.id, name: m.name })),
          language,
          language === 'sw'
            ? `Nimepata kampuni zaidi ya moja kwa "${candidate}". Chagua moja:`
            : `I found multiple companies matching "${candidate}". Choose one:`,
        ),
      };
    }

    return {
      handled: true,
      response: this.renderCompanyDisambiguation(
        (session.lastResults || []).map((r) => ({ id: r.id, name: r.name })),
        language,
        language === 'sw'
          ? `Sikuona kampuni inayolingana na "${candidate}". Chagua kwa nambari kutoka orodha:`
          : `I couldn't find a company matching "${candidate}". Reply with a number from the list:`,
      ),
    };
  }

  private handleMainMenuSelection(
    id: string,
    language: string,
  ): MenuRouteResult {
    const isSw = language === 'sw';
    switch (id) {
      case 'menu_properties':
        return { handled: true, tool: { name: 'list_properties' } };
      case 'menu_tenants':
        return { handled: true, tool: { name: 'list_tenants' } };
      case 'menu_units':
        return { handled: true, tool: { name: 'list_units' } };
      case 'menu_financials':
        return { handled: true, tool: { name: 'get_company_summary' } };
      case 'menu_reports':
        return {
          handled: true,
          tool: {
            name: 'generate_report_file',
            args: { reportType: 'Summary', format: 'pdf' },
          },
        };

      // Super Admin
      case 'menu_companies':
        return { handled: true, tool: { name: 'list_companies' } };
      case 'menu_system_health':
        return { handled: true, tool: { name: 'get_company_summary' } }; // Use default summary for health for now
      case 'menu_platform_report':
        return {
          handled: true,
          tool: {
            name: 'generate_report_file',
            args: { scope: 'platform', format: 'pdf' },
          },
        };

      // Tenant
      case 'menu_tenant_balance':
        return {
          handled: true,
          tool: { name: 'list_invoices', args: { status: 'OPEN' } },
        };
      case 'menu_tenant_receipt':
        return {
          handled: true,
          tool: { name: 'generate_receipt', args: { scope: 'last_payment' } },
        };
      case 'menu_tenant_statement':
        return {
          handled: true,
          tool: {
            name: 'generate_report_file',
            args: { reportType: 'Tenant Statement', format: 'pdf' },
          },
        };
      case 'menu_tenant_maintenance':
        return { handled: true, tool: { name: 'create_maintenance_request' } };

      // Landlord
      case 'menu_landlord_status':
        return { handled: true, tool: { name: 'get_portfolio_arrears' } };
      case 'menu_landlord_vacancies':
        return { handled: true, tool: { name: 'list_vacant_units' } };
      case 'menu_landlord_report':
        return {
          handled: true,
          tool: {
            name: 'generate_report_file',
            args: { reportType: 'Portfolio', format: 'pdf' },
          },
        };
      case 'menu_landlord_agent':
        return {
          handled: true,
          tool: { name: 'get_company_staff', args: { role: 'AGENT' } },
        };

      case 'menu_help':
        return {
          handled: true,
          response: isSw
            ? 'Aedra ni msaidizi wako wa usimamizi wa majengo. Unaweza:\n\n1. Kuangalia hali ya kodi\n2. Kusajili wapangaji\n3. Kupata ripoti za PDF\n\nNime hapa kukusaidia!'
            : 'Aedra is your property management assistant. You can:\n\n1. Check rent collection status\n2. Register tenants\n3. Generate PDF reports\n\nI am here to help!',
        };
      case 'menu_settings':
        return {
          handled: true,
          response: isSw
            ? 'Mipangilio iko njiani! Kwa sasa, unaweza kubadili lugha kwa kusema "Speak English".'
            : 'Settings are coming soon! For now, you can switch language by saying "Badili lugha kwa Kiswahili".',
        };
      default:
        return { handled: false };
    }
  }

  private handleAuthSelection(id: string, language: string): MenuRouteResult {
    const isSw = language === 'sw';
    switch (id) {
      case 'auth_register':
        return {
          handled: true,
          response: isSw
            ? 'Ili kusajili kampuni yako, tafadhali nipe jina la kampuni na barua pepe yako (mfano: "Sajili kampuni ya ABC, email: abc@example.com")'
            : 'To register your company, please provide your company name and email (e.g., "Register company ABC, email: abc@example.com")',
        };
      case 'auth_support':
        return {
          handled: true,
          response: isSw
            ? 'Msaada wa kiufundi unakuja! Kwa sasa, tafadhali acha ujumbe wako hapa na timu yetu itakupigia.'
            : 'Technical support is on its way! For now, please leave your message here and our team will get back to you.',
        };
      default:
        return { handled: false };
    }
  }
}
