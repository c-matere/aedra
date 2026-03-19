export const formatPropertyList = (properties: any[]) => {
    if (!properties || properties.length === 0) return 'I couldn\'t find any properties in the portfolio right now.';
    const lines = properties.map((p: any, idx: number) => {
        const address = p.address ? ` — ${p.address}` : '';
        const landlord = p.landlord ? ` (Landlord: ${p.landlord.firstName} ${p.landlord.lastName})` : '';
        return `${idx + 1}. ${p.name}${address}${landlord}`;
    });
    return `Here are the properties on file:\n${lines.join('\n')}`;
};

export const formatTenantList = (tenants: any[], query?: string) => {
    if (!tenants || tenants.length === 0) {
        return query ? `I looked for tenants matching "${query}" but didn't find anyone.` : 'I don\'t see any tenants listed here yet.';
    }
    const lines = tenants.map((t: any, idx: number) => {
        const name = `${t.firstName} ${t.lastName}`.trim();
        const property = t.property?.name ? ` — ${t.property.name}` : '';
        const phone = t.phone ? ` — ${t.phone}` : '';
        return `${idx + 1}. ${name}${property}${phone}`;
    });
    const header = query ? `I found these tenants matching "${query}":` : 'Here are the tenants currently in the system:';
    return `${header}\n${lines.join('\n')}`;
};

const COMPANY_PAGE_SIZE = 8;

export const formatCompanyList = (
    companies: any[],
    query?: string,
    page: number = 1,
    language: 'en' | 'sw' = 'en'
) => {
    if (!companies || companies.length === 0) {
        return query ? `No companies found matching "${query}".` : 'No companies found.';
    }

    const total = companies.length;
    const start = Math.max(0, (page - 1) * COMPANY_PAGE_SIZE);
    const pageItems = companies.slice(start, start + COMPANY_PAGE_SIZE);
    const hasMore = start + COMPANY_PAGE_SIZE < total;

    const showingNote = hasMore
        ? (language === 'sw'
            ? ` (${pageItems.length} zinaonyeshwa kwanza)`
            : ` (showing first ${pageItems.length})`)
        : '';

    const header = language === 'sw'
        ? `${total} kampuni zimepatikana${showingNote}.`
        : `${total} companies found${showingNote}.`;

    const list = pageItems
        .map((c: any, idx: number) => `${start + idx + 1}. ${c.name}`)
        .join('\n');

    const basePrompt = language === 'sw'
        ? 'Jibu na nambari kuchagua, au andika sehemu ya jina kutafuta.'
        : 'Reply with a number to select, or type part of a name to search.';

    return `${header}\n\n${list}\n\n${basePrompt}`;
};

export const formatUnitList = (units: any[], query?: string) => {
    if (!units || units.length === 0) {
        return query ? `No units found matching "${query}".` : 'No units found.';
    }
    const lines = units.map((u: any, idx: number) => {
        const property = u.property?.name ? ` [${u.property.name}]` : '';
        const status = u.status ? ` — ${u.status}` : '';
        const rent = u.rentAmount ? ` — Rent: ${u.rentAmount}` : '';
        return `${idx + 1}. Unit ${u.unitNumber}${property}${status}${rent}`;
    });
    const header = query ? `Here are matching units for "${query}":` : 'Here are the units:';
    return `${header}\n${lines.join('\n')}`;
};

export const formatLeaseList = (leases: any[]) => {
    if (!leases || leases.length === 0) return 'No leases found.';
    const lines = leases.map((l: any, idx: number) => {
        const tenant = l.tenant ? `${l.tenant.firstName} ${l.tenant.lastName}` : 'Unknown Tenant';
        const unit = l.unit ? ` — Unit ${l.unit.unitNumber}` : '';
        const property = l.property ? ` (${l.property.name})` : '';
        const status = ` [${l.status}]`;
        return `${idx + 1}. ${tenant}${unit}${property}${status}`;
    });
    return `Here are the leases:\n${lines.join('\n')}`;
};

export const formatPaymentList = (payments: any[]) => {
    if (!payments || payments.length === 0) return 'I don\'t see any recorded payments for this account yet.';
    
    // Sort by date to analyze consistency
    const sorted = [...payments].sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
    
    const lines = sorted.map((p: any, idx: number) => {
        const date = p.paidAt ? new Date(p.paidAt).toLocaleDateString() : 'N/A';
        const amount = p.amount ? p.amount.toLocaleString() : '0';
        const method = p.method ? ` via ${p.method}` : '';
        const type = p.type ? ` (${p.type})` : '';
        return `${idx + 1}. ${date}: KES ${amount}${method}${type}`;
    });

    let summary = '';
    if (payments.length >= 2) {
        const amounts = payments.map(p => p.amount);
        const uniqueAmounts = new Set(amounts);
        if (uniqueAmounts.size === 1) {
            summary = `\n\nPayments are consistent at KES ${amounts[0].toLocaleString()}. No arrears noted based on this history.`;
        } else {
            summary = `\n\nI've noted ${payments.length} payments with some variation in amounts—I'll keep monitoring for consistency.`;
        }
    }

    return `Here's the payment history:\n${lines.join('\n')}${summary}`;
};

export const formatInvoiceList = (invoices: any[]) => {
    if (!invoices || invoices.length === 0) return 'Everything is clear on this side — I don\'t see any outstanding invoices.';
    const lines = invoices.map((i: any, idx: number) => {
        const date = i.dueDate ? new Date(i.dueDate).toLocaleDateString() : 'N/A';
        const amount = i.amount ? i.amount.toLocaleString() : '0';
        const status = ` [${i.status}]`;
        return `${idx + 1}. Due ${date}: KES ${amount}${status} — ${i.description}`;
    });
    return `Here are the invoices currently on record:\n${lines.join('\n')}`;
};

export const formatMaintenanceRequestList = (requests: any[]) => {
    if (!requests || requests.length === 0) return 'No maintenance requests found.';
    const lines = requests.map((r: any, idx: number) => {
        const priority = r.priority ? `[${r.priority}] ` : '';
        const status = r.status ? `(${r.status})` : '';
        const property = r.property ? ` — ${r.property.name}` : '';
        return `${idx + 1}. ${priority}${r.title} ${status}${property}`;
    });
    return `Here are the maintenance requests:\n${lines.join('\n')}`;
};

export const formatExpenseList = (expenses: any[]) => {
    if (!expenses || expenses.length === 0) return 'No expenses found.';
    const lines = expenses.map((e: any, idx: number) => {
        const date = e.date ? new Date(e.date).toLocaleDateString() : 'N/A';
        const amount = e.amount ? e.amount.toLocaleString() : '0';
        const property = e.property ? ` (${e.property.name})` : '';
        const category = e.category ? ` [${e.category}]` : '';
        return `${idx + 1}. ${date}: ${amount}${property}${category} — ${e.description || 'No description'}`;
    });
    return `Here are the expenses:\n${lines.join('\n')}`;
};

export const formatLandlordList = (landlords: any[], query?: string) => {
    if (!landlords || landlords.length === 0) {
        return query ? `No landlords found matching "${query}".` : 'No landlords found.';
    }
    const lines = landlords.map((l: any, idx: number) => {
        const name = `${l.firstName} ${l.lastName}`.trim();
        const phone = l.phone ? ` — ${l.phone}` : '';
        return `${idx + 1}. ${name}${phone}`;
    });
    const header = query ? `Here are matching landlords for "${query}":` : 'Here are the landlords:';
    return `${header}\n${lines.join('\n')}`;
};

export const formatStaffList = (staff: any[], query?: string) => {
    if (!staff || staff.length === 0) {
        return query ? `No staff members found matching "${query}".` : 'No staff members found.';
    }
    const lines = staff.map((s: any, idx: number) => {
        const name = `${s.firstName} ${s.lastName}`.trim();
        const role = s.role ? ` [${s.role}]` : '';
        const email = s.email ? ` — ${s.email}` : '';
        return `${idx + 1}. ${name}${role}${email}`;
    });
    const header = query ? `Here are matching staff members for "${query}":` : 'Here are the staff members:';
    return `${header}\n${lines.join('\n')}`;
};

export const formatPropertyDetails = (p: any) => {
    if (!p) return 'Property not found.';
    const landlord = p.landlord ? `\nLandlord: ${p.landlord.firstName} ${p.landlord.lastName}` : '';
    const units = p.units ? `\nUnits: ${p.units.length}` : '';
    return `Property Details:
Name: ${p.name}
Address: ${p.address || 'N/A'}
Description: ${p.description || 'N/A'}${landlord}${units}
ID: ${p.id}`;
};

export const formatTenantDetails = (t: any) => {
    if (!t) return 'Tenant not found.';
    const property = t.property ? `\nProperty: ${t.property.name}` : '';
    const leases = t.leases ? `\nLeases: ${t.leases.length}` : '';
    return `Tenant Details:
Name: ${t.firstName} ${t.lastName}
Email: ${t.email || 'N/A'}
Phone: ${t.phone || 'N/A'}${property}${leases}
ID: ${t.id}`;
};

export const formatLeaseDetails = (l: any) => {
    if (!l) return 'Lease not found.';
    const tenant = l.tenant ? `\nTenant: ${l.tenant.firstName} ${l.tenant.lastName}` : '';
    const unit = l.unit ? `\nUnit: ${l.unit.unitNumber}` : '';
    const property = l.property ? `\nProperty: ${l.property.name}` : '';
    const payments = l.payments ? `\nTotal Payments: ${l.payments.length}` : '';
    const invoices = l.invoices ? `\nTotal Invoices: ${l.invoices.length}` : '';
    return `Lease Details:
Status: ${l.status}
Rent: ${l.rentAmount || 0}${tenant}${unit}${property}${payments}${invoices}
ID: ${l.id}`;
};

export const formatUnitDetails = (u: any) => {
    if (!u) return 'Unit not found.';
    const property = u.property ? `\nProperty: ${u.property.name}` : '';
    return `Unit Details:
Unit Number: ${u.unitNumber}
Status: ${u.status}
Rent: ${u.rentAmount || 0}${property}
ID: ${u.id}`;
};

export const formatMaintenanceRequestDetails = (r: any) => {
    if (!r) return 'Maintenance request not found.';
    const property = r.property ? `\nProperty: ${r.property.name}` : '';
    const unit = r.unit ? `\nUnit: ${r.unit.unitNumber}` : '';
    return `Maintenance Request Details:
Title: ${r.title}
Status: ${r.status}
Priority: ${r.priority}
Category: ${r.category}
Description: ${r.description || 'N/A'}${property}${unit}
ID: ${r.id}`;
};

export const formatLandlordDetails = (l: any) => {
    if (!l) return 'Landlord not found.';
    return `Landlord Details:
Name: ${l.firstName} ${l.lastName}
Email: ${l.email || 'N/A'}
Phone: ${l.phone || 'N/A'}
ID: ${l.id}`;
};

export const formatStaffDetails = (s: any) => {
    if (!s) return 'Staff member not found.';
    return `Staff Details:
Name: ${s.firstName} ${s.lastName}
Email: ${s.email || 'N/A'}
Role: ${s.role || 'N/A'}
ID: ${s.id}`;
};

export const formatGenericSuccess = (message: string, details?: any) => {
    let result = `Success: ${message}`;
    if (details && typeof details === 'object') {
        const detailLines = Object.entries(details)
            .filter(([_, v]) => v !== null && v !== undefined && typeof v !== 'object')
            .map(([k, v]) => `${k}: ${v}`);
        if (detailLines.length > 0) {
            result += `\n\nDetails:\n${detailLines.join('\n')}`;
        }
    }
    return result;
};

export const formatCompanySummary = (data: any) => {
    if (!data) return 'Unable to retrieve company summary.';
    
    const { companyName, dateRange, properties, units, tenants, activeLeases, totals } = data;
    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });

    return `*COMPANY SUMMARY REPORT: ${companyName || 'General'}*
---------------------------
📅 *Period:* ${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}

🏢 *Infrastructure:*
- Properties: ${properties}
- Total Units: ${units.total}
- Occupancy: ${units.occupied} occupied / ${units.vacant} vacant

👥 *Stakeholders:*
- Active Tenants: ${tenants}
- Active Leases: ${activeLeases}

💰 *Financials (KES):*
- Total Payments: ${totals.payments.toLocaleString()}
- Total Expenses: ${totals.expenses.toLocaleString()}
- Total Billed: ${totals.invoices.toLocaleString()}
- Overdue Invoices: ${totals.overdueInvoices}

_Report generated by Aedra AI_`;
};

export const formatTenantStatement = (tenant: any, invoices: any[], payments: any[]) => {
    if (!tenant) return 'Tenant not found.';
    
    const overdue = invoices.filter(i => i.status === 'PENDING' && new Date(i.dueDate) < new Date()).reduce((acc, i) => acc + i.amount, 0);
    const paid = payments.reduce((acc, p) => acc + p.amount, 0);
    const billed = invoices.reduce((acc, i) => acc + i.amount, 0);
    
    const invoiceLines = invoices.slice(0, 10).map((i, idx) => {
        const date = new Date(i.dueDate).toLocaleDateString();
        return `- ${date}: KES ${i.amount.toLocaleString()} [${i.status}]`;
    });
    
    const paymentLines = payments.slice(0, 10).map((p, idx) => {
        const date = new Date(p.paidAt).toLocaleDateString();
        return `- ${date}: KES ${p.amount.toLocaleString()} via ${p.method}`;
    });

    return `*ACCOUNT STATEMENT: ${tenant.firstName} ${tenant.lastName}*
---------------------------
💰 *Summary:*
- Total Billed: KES ${billed.toLocaleString()}
- Total Paid: KES ${paid.toLocaleString()}
- Balance Due: KES ${(billed - paid).toLocaleString()}
- *Overdue Amount:* KES ${overdue.toLocaleString()}

🧾 *Recent Invoices (last 10):*
${invoiceLines.length > 0 ? invoiceLines.join('\n') : 'No invoices found.'}

💸 *Recent Payments (last 10):*
${paymentLines.length > 0 ? paymentLines.join('\n') : 'No payments found.'}

_Generated by Aedra AI_`;
};
