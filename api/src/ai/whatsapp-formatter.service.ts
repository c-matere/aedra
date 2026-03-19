import { Injectable } from '@nestjs/common';
import * as formatters from './ai.formatters';

@Injectable()
export class WhatsAppFormatterService {
    /**
     * Formats a raw result into a WhatsApp-friendly string and optional interactive payload.
     */
    formatResult(action: string, data: any, language: string = 'en'): { text: string; interactive?: any } {
        let text = '';
        let interactive: any = undefined;

        switch (action) {
            case 'list_properties':
                text = formatters.formatPropertyList(data);
                interactive = this.buildListMessage(text, 'Properties', data.map((p: any) => ({
                    id: p.id,
                    title: p.name.slice(0, 24),
                    description: p.address?.slice(0, 72) || 'No address'
                })), language);
                break;

            case 'list_tenants':
            case 'search_tenants':
                text = formatters.formatTenantList(data);
                interactive = this.buildListMessage(text, 'Tenants', data.map((t: any) => ({
                    id: t.id,
                    title: `${t.firstName} ${t.lastName}`.slice(0, 24),
                    description: t.property?.name?.slice(0, 72) || 'No property'
                })), language);
                break;

            case 'list_units':
            case 'search_units':
                text = formatters.formatUnitList(data);
                interactive = this.buildListMessage(text, 'Units', data.map((u: any) => ({
                    id: u.id,
                    title: `Unit ${u.unitNumber}`.slice(0, 24),
                    description: `${u.property?.name?.slice(0, 30)} - ${u.status}`.slice(0, 72)
                })), language);
                break;

            case 'get_property_details':
                text = formatters.formatPropertyDetails(data);
                break;

            case 'get_unit_details':
                text = formatters.formatUnitDetails(data);
                break;

            case 'get_tenant_details':
                text = formatters.formatTenantDetails(data);
                break;

            case 'get_company_summary':
                text = formatters.formatCompanySummary(data);
                break;

            case 'get_tenant_statement':
                text = formatters.formatTenantStatement(data.tenant, data.invoices, data.payments);
                break;

            case 'list_maintenance_requests':
                text = formatters.formatMaintenanceRequestList(data);
                break;

            case 'list_payments':
                text = formatters.formatPaymentList(data);
                break;

            case 'list_invoices':
                text = formatters.formatInvoiceList(data);
                break;

            case 'list_expenses':
                text = formatters.formatExpenseList(data);
                break;

            case 'create_payment':
                text = formatters.formatPaymentReceipt(data);
                break;

            case 'create_invoice':
                text = formatters.formatInvoiceSuccess(data);
                break;

            case 'select_company':
            case 'switch_company':
                text = (typeof data === 'object' && data?.data) ? data.data : (typeof data === 'string' ? data : '✅ Workspace updated.');
                break;

            default:
                text = typeof data === 'string' ? data : (data?.data || JSON.stringify(data, null, 2));
        }

        return { text, interactive };
    }

    /**
     * Builds a WhatsApp List Message payload with multiple sections.
     */
    buildMultiSectionListMessage(bodyText: string, sections: { title: string; rows: { id: string; title: string; description?: string }[] }[], buttonLabel: string, language: string): any {
        if (!sections || sections.length === 0) return undefined;

        const footerText = language === 'sw' ? 'Tumia menyu hapo juu kuchagua' : 'Use the menu above to select';

        return {
            type: 'list',
            header: { type: 'text', text: 'Aedra AI' },
            body: { text: bodyText.slice(0, 1024) },
            footer: { text: footerText },
            action: {
                button: buttonLabel.slice(0, 20),
                sections: sections.map(s => ({
                    title: s.title.slice(0, 24),
                    rows: s.rows.map(r => ({
                        id: r.id,
                        title: r.title.slice(0, 24),
                        description: r.description?.slice(0, 72)
                    }))
                }))
            }
        };
    }

    /**
     * Builds a WhatsApp List Message payload.
     */
    buildListMessage(bodyText: string, title: string, rows: { id: string; title: string; description?: string }[], language: string): any {
        if (!rows || rows.length === 0 || rows.length > 10) return undefined;

        return this.buildMultiSectionListMessage(bodyText, [{ title: title, rows }], language === 'sw' ? 'Chagua' : 'Select', language);
    }

    /**
     * Builds a WhatsApp Button Message payload, or falls back to List if too many options.
     */
    buildButtonMessage(bodyText: string, options: { key: string; label: string; action: string }[], language: string = 'en'): any {
        if (!options || options.length === 0) return undefined;

        // WhatsApp allows max 3 buttons. If more, use a List.
        if (options.length > 3) {
            return this.buildListMessage(bodyText, 'Actions', options.map(o => ({
                id: o.action,
                title: o.label.slice(0, 24)
            })), language);
        }

        return {
            type: 'button',
            header: { type: 'text', text: 'Quick Action' },
            body: { text: bodyText.slice(0, 1024) },
            footer: { text: 'Select an option below' },
            action: {
                buttons: options.map(o => ({
                    type: 'reply',
                    reply: { id: o.action, title: o.label.slice(0, 20) }
                }))
            }
        };
    }
}
