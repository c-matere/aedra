import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { WhatsAppFormatterService } from './whatsapp-formatter.service';
import { MainMenuService } from './main-menu.service';
import * as natural from 'natural';

type MenuSelectionType = 'company' | 'property' | 'tenant' | 'unit';

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
    const parsed =
      typeof cached === 'string'
        ? (() => {
            try {
              return JSON.parse(cached);
            } catch {
              return null;
            }
          })()
        : cached;
    if (!parsed || typeof parsed !== 'object') return { userId: uid };
    return { ...(parsed as any), userId: uid };
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
    const lowered = text.toLowerCase();

    // Direct tool IDs from interactive list replies (bypass LLM planner)
    // Example: list_reply.id = "get_portfolio_arrears"
    const directToolIds = new Set([
      'get_portfolio_arrears',
      'get_financial_summary',
      'get_financial_report',
      'list_vacant_units',
      'list_properties',
      'list_units',
      'list_tenants',
      'list_companies',
    ]);
    if (directToolIds.has(text)) {
      return { handled: true, tool: { name: text } };
    }

    // Deterministic action strings from WhatsApp buttons (tool:id)
    // Example: "get_tenant_arrears:0078...1175"
    const actionMatch = text.match(
      /^([a-z_]+):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?::(.+))?$/i,
    );
    if (actionMatch) {
      const tool = actionMatch[1];
      const id = actionMatch[2];
      const tenantIdTools = new Set([
        'get_tenant_details',
        'get_tenant_arrears',
        'get_tenant_statement',
      ]);
      const propertyIdTools = new Set(['get_property_details', 'get_property_arrears']);
      const unitIdTools = new Set(['get_unit_details']);

      if (tenantIdTools.has(tool)) {
        return {
          handled: true,
          tool: {
            name: tool,
            args: {
              tenantId: id,
              ...(tool === 'get_tenant_details' ? { id } : {}),
            },
          },
        };
      }
      if (propertyIdTools.has(tool)) {
        return {
          handled: true,
          tool: { name: tool === 'get_property_arrears' ? 'get_portfolio_arrears' : tool, args: { propertyId: id } },
        };
      }
      if (unitIdTools.has(tool)) {
        return { handled: true, tool: { name: tool, args: { unitId: id } } };
      }
    }

    // Handle Main Menu selections (Ids starting with menu_)
    if (text.startsWith('menu_')) {
      return this.handleMainMenuSelection(text, language);
    }

    // Handle Auth selections (Ids starting with auth_)
    if (text.startsWith('auth_')) {
      return this.handleAuthSelection(text, language);
    }

    // Harden common interactive IDs (avoid underscores/planning issues/spaces)
    const cleanLower = lowered.replace(/_/g, ' ').trim();
    if (cleanLower === 'list tenants' || cleanLower === 'view tenants' || text === 'list_tenants') {
      return { handled: true, tool: { name: 'list_tenants', args: { limit: 20 } } };
    }
    if (cleanLower === 'list companies' || cleanLower === 'view companies' || text === 'list_companies' || text === 'menu_companies') {
      return { handled: true, tool: { name: 'list_companies' } };
    }
    if (cleanLower === 'list properties' || cleanLower === 'view properties' || text === 'list_properties') {
      return { handled: true, tool: { name: 'list_properties' } };
    }

    // Common power-user commands (bypass LLM planner for deterministic output)
    if (/^(list|show|view)\s+tenants\b/.test(lowered) || /^tenants\b/.test(lowered) || text.startsWith('list_tenants')) {
      const parts = text.split(':');
      return {
        handled: true,
        tool: { 
          name: 'list_tenants', 
          args: { 
            limit: 20,
            ...(parts[1] ? { propertyId: parts[1] } : {})
          } 
        },
      };
    }

    if (text.startsWith('get_property_arrears:')) {
      const parts = text.split(':');
      return {
        handled: true,
        tool: {
          name: 'get_portfolio_arrears',
          args: { propertyId: parts[1] },
        },
      };
    }

    // Reports (avoid LLM/tool-planning ambiguity; generate a default PDF)
    // Supported examples:
    // - "report" -> company summary (requires selected company)
    // - "report platform" -> platform summary (SUPER_ADMIN only)
    // - "report property Palm Grove" / "report Palm Grove" -> property scoped (requires selected company)
    if (/^repor(t|ts)?\b/.test(lowered) || lowered === 'repor') {
      const normalized = lowered.replace(/\s+/g, ' ').trim();
      const afterKeyword = normalized.replace(/^repor(t|ts)?\b\s*/i, '').trim();
      const wantsPlatform = /\bplatform\b/.test(normalized);
      const wantsCompany = /\bcompany\b/.test(normalized);

      // Property form: "property <name>" OR "report <name>"
      let propertyName: string | undefined;
      const propMatch = afterKeyword.match(/^property\s+(.+)$/i);
      if (propMatch?.[1]) propertyName = propMatch[1].trim();
      else if (afterKeyword && !wantsPlatform && !wantsCompany) propertyName = afterKeyword;

      return {
        handled: true,
        tool: {
          name: 'generate_report_file',
          args: {
            reportType: 'Summary',
            format: 'pdf',
            scope: wantsPlatform ? 'platform' : propertyName ? 'property' : 'company',
            ...(propertyName ? { propertyName } : {}),
          },
        },
      };
    }

    if (text.startsWith('generate_report_file:')) {
      const parts = text.split(':');
      return {
        handled: true,
        tool: {
          name: 'generate_report_file',
          args: {
            propertyId: parts[1],
            reportType: parts[2] || 'Summary',
            format: 'pdf',
            scope: 'property',
          },
        },
      };
    }

    const session = await this.loadSession(uid);
    if (!session.awaitingSelection) return { handled: false };

    // Generic selection handler for cached lists (numeric replies OR list_reply ids)
    const selectionToolForType = (
      type: MenuSelectionType,
    ): { name: string; argKey: string } | null => {
      switch (type) {
        case 'company':
          return { name: 'select_company', argKey: 'companyId' };
        case 'property':
          return { name: 'get_property_details', argKey: 'propertyId' };
        case 'tenant':
          return { name: 'get_tenant_details', argKey: 'tenantId' };
        case 'unit':
          return { name: 'get_unit_details', argKey: 'unitId' };
        default:
          return null;
      }
    };

    const resolveSelection = (input: string) => {
      const idx = this.extractSelectionIndex(input);
      if (idx) return session.lastResults?.[idx - 1] || null;

      // 1. Try exact UUID match
      const uuidMatch = session.lastResults?.find((r) => r.id === input);
      if (uuidMatch) return uuidMatch;

      // 2. Try Name Match (Case-Insensitive OR Fuzzy)
      if (session.lastResults && session.lastResults.length > 0) {
        const query = input.toLowerCase().trim();
        
        // Exact / Substring match (normalized)
        const directMatch = session.lastResults.find(r => 
          r.name.toLowerCase().includes(query) || 
          query.includes(r.name.toLowerCase())
        );
        if (directMatch) return directMatch;

        // Fuzzy match using Jaro-Winkler (threshold 0.85)
        const candidates = session.lastResults.map(r => ({
          ...r,
          score: natural.JaroWinklerDistance(query, r.name.toLowerCase(), { ignoreCase: true })
        })).sort((a, b) => b.score - a.score);

        if (candidates[0] && candidates[0].score >= 0.85) {
          return candidates[0];
        }
      }

      return null;
    };

    // If we're awaiting ANY selection (company/property/tenant/unit), attempt to resolve.
    const selectedGeneric = resolveSelection(text);
    if (
      selectedGeneric &&
      (selectedGeneric.type === session.awaitingSelection ||
        session.awaitingSelection === 'company')
    ) {
      const mapping = selectionToolForType(
        selectedGeneric.type as MenuSelectionType,
      );
      if (mapping) {
        await this.saveSession(uid, {
          activeCompanyId:
            selectedGeneric.type === 'company'
              ? selectedGeneric.id
              : session.activeCompanyId,
          awaitingSelection: undefined,
        });
        return {
          handled: true,
          tool: { name: mapping.name, args: { [mapping.argKey]: selectedGeneric.id } },
          response:
            selectedGeneric.type === 'company'
              ? language === 'sw'
                ? `✅ Umehamia ${selectedGeneric.name}.`
                : `✅ Switched to ${selectedGeneric.name}.`
              : undefined,
        };
      }
    }

    // Existing company-selection disambiguation UX
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
            ? 'Chagua kampuni kwa nambari hapa:'
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
          ? `Sikuona kampuni inayolingana na "${candidate}". Chagua hapa kwa nambari:`
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
        return { handled: true, tool: { name: 'get_financial_summary' } };
      case 'menu_reports':
        return {
          handled: true,
          tool: {
            name: 'generate_report_file',
            args: { reportType: 'Summary', format: 'pdf', scope: 'company' },
          },
        };

      // Super Admin
      case 'menu_companies':
        return { handled: true, tool: { name: 'list_companies' } };
      case 'menu_system_health':
        return { handled: true, tool: { name: 'get_financial_summary' } }; // Use portfolio summary as health snapshot for now
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
