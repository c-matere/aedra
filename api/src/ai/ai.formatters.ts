export const formatPropertyList = (properties: any[]) => {
  if (!properties || properties.length === 0)
    return "📂 I couldn't find any properties in the portfolio right now.";
  const lines = properties.map((p: any, idx: number) => {
    const address = p.address ? ` — _${p.address}_` : '';
    const landlord = p.landlord
      ? ` (👤 *Landlord:* ${p.landlord.firstName})`
      : '';
    return `*${idx + 1}.* ${p.name}${address}${landlord}`;
  });
  return `📂 *Properties on file:*\n\n${lines.join('\n')}`;
};

export const formatTenantList = (tenants: any[], query?: string) => {
  if (!tenants || tenants.length === 0) {
    return query
      ? `🔍 I looked for tenants matching *"${query}"* but didn't find anyone.`
      : "👤 I don't see any tenants listed here yet.";
  }
  const lines = tenants.map((t: any, idx: number) => {
    const name = `*${t.firstName} ${t.lastName}*`.trim();
    const property = t.property?.name ? ` — 📂 _${t.property.name}_` : '';
    const phone = t.phone ? ` — 📞 _${t.phone}_` : '';
    return `*${idx + 1}.* ${name}${property}${phone}`;
  });
  const header = query
    ? `🔍 *Found these tenants matching "${query}":*`
    : '👤 *Current Tenants:*';
  return `${header}\n\n${lines.join('\n')}`;
};

const COMPANY_PAGE_SIZE = 8;

export const formatCompanyList = (
  companies: any[],
  query?: string,
  page: number = 1,
  language: 'en' | 'sw' = 'en',
) => {
  if (!companies || companies.length === 0) {
    return query
      ? `No companies found matching "${query}".`
      : 'No companies found.';
  }

  const total = companies.length;
  const start = Math.max(0, (page - 1) * COMPANY_PAGE_SIZE);
  const pageItems = companies.slice(start, start + COMPANY_PAGE_SIZE);
  const hasMore = start + COMPANY_PAGE_SIZE < total;

  const showingNote = hasMore
    ? language === 'sw'
      ? ` (${pageItems.length} zinaonyeshwa kwanza)`
      : ` (showing first ${pageItems.length})`
    : '';

  const header =
    language === 'sw'
      ? `${total} kampuni zimepatikana${showingNote}.`
      : `${total} companies found${showingNote}.`;

  const list = pageItems
    .map((c: any, idx: number) => `${start + idx + 1}. ${c.name}`)
    .join('\n');

  const basePrompt =
    language === 'sw'
      ? 'Jibu na nambari kuchagua, au andika sehemu ya jina kutafuta.'
      : 'Reply with a number to select, or type part of a name to search.';

  return `${header}\n\n${list}\n\n${basePrompt}`;
};

export const formatUnitList = (units: any[], query?: string) => {
  if (!units || units.length === 0) {
    return query
      ? `🔍 No units found matching *"${query}"*.`
      : '🏠 No units found.';
  }
  const lines = units.map((u: any, idx: number) => {
    const property = u.property?.name ? ` [_${u.property.name}_]` : '';
    const status = u.status ? ` — *${u.status}*` : '';
    const rent = u.rentAmount
      ? ` — 💰 *KES ${u.rentAmount.toLocaleString()}*`
      : '';
    return `*${idx + 1}.* Unit *${u.unitNumber}*${property}${status}${rent}`;
  });
  const header = query
    ? `🔍 *Matching units for "${query}":*`
    : '🏠 *Unit Availability:*';
  return `${header}\n\n${lines.join('\n')}`;
};

export const formatLeaseList = (leases: any[]) => {
  if (!leases || leases.length === 0) return 'No leases found.';
  const lines = leases.map((l: any, idx: number) => {
    const tenant = l.tenant
      ? `${l.tenant.firstName} ${l.tenant.lastName}`
      : 'Unknown Tenant';
    const unit = l.unit ? ` — Unit ${l.unit.unitNumber}` : '';
    const property = l.property ? ` (${l.property.name})` : '';
    const status = ` [${l.status}]`;
    return `${idx + 1}. ${tenant}${unit}${property}${status}`;
  });
  return `Here are the leases:\n${lines.join('\n')}`;
};

export const formatPaymentList = (payments: any[]) => {
  if (!payments || payments.length === 0)
    return "💸 I don't see any recorded payments for this account yet.";

  // Sort by date to analyze consistency
  const sorted = [...payments].sort(
    (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime(),
  );

  const lines = sorted.map((p: any, idx: number) => {
    const date = p.paidAt ? new Date(p.paidAt).toLocaleDateString() : 'N/A';
    const amount = p.amount ? p.amount.toLocaleString() : '0';
    const method = p.method ? ` 💳 _${p.method}_` : '';
    const type = p.type ? ` (${p.type})` : '';
    return `*${idx + 1}.* ${date}: *KES ${amount}*${method}${type}`;
  });

  let summary = '';
  if (payments.length >= 2) {
    const amounts = payments.map((p) => p.amount);
    const uniqueAmounts = new Set(amounts);
    if (uniqueAmounts.size === 1) {
      summary = `\n\n✅ *Insights:*\nPayments are consistent at *KES ${amounts[0].toLocaleString()}*. No arrears noted based on this history.`;
    } else {
      summary = `\n\nℹ️ *Insights:*\nI've noted ${payments.length} payments with variation in amounts—I'll keep monitoring for consistency.`;
    }
  }

  return `💸 *Payment History:*\n\n${lines.join('\n')}${summary}`;
};

export const formatInvoiceList = (invoices: any[]) => {
  if (!invoices || invoices.length === 0)
    return "🧾 Everything is clear — I don't see any outstanding invoices.";
  const lines = invoices.map((i: any, idx: number) => {
    const date = i.dueDate ? new Date(i.dueDate).toLocaleDateString() : 'N/A';
    const amount = i.amount ? i.amount.toLocaleString() : '0';
    const statusEmoji = i.status === 'PAID' ? '✅' : '⏳';
    const status = ` *[${i.status}]*`;
    return `*${idx + 1}.* Due ${date}: *KES ${amount}* ${statusEmoji}${status} — _${i.description}_`;
  });
  return `🧾 *Outstanding Invoices:*\n\n${lines.join('\n')}`;
};

export const formatMaintenanceRequestList = (requests: any[]) => {
  if (!requests || requests.length === 0)
    return '🛠 No maintenance requests found.';
  const lines = requests.map((r: any, idx: number) => {
    const priorityEmoji =
      r.priority === 'HIGH' ? '🔴' : r.priority === 'MEDIUM' ? '🟠' : '🟡';
    const priority = r.priority ? `${priorityEmoji} *${r.priority}* ` : '';
    const status = r.status ? `(_${r.status}_)` : '';
    const property = r.property ? ` — 📂 _${r.property.name}_` : '';
    return `*${idx + 1}.* ${priority}${r.title} ${status}${property}`;
  });
  return `🛠 *Maintenance Requests:*\n\n${lines.join('\n')}`;
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
    return query
      ? `No landlords found matching "${query}".`
      : 'No landlords found.';
  }
  const lines = landlords.map((l: any, idx: number) => {
    const name = `${l.firstName} ${l.lastName}`.trim();
    const phone = l.phone ? ` — ${l.phone}` : '';
    return `${idx + 1}. ${name}${phone}`;
  });
  const header = query
    ? `Here are matching landlords for "${query}":`
    : 'Here are the landlords:';
  return `${header}\n${lines.join('\n')}`;
};

export const formatStaffList = (staff: any[], query?: string) => {
  if (!staff || staff.length === 0) {
    return query
      ? `No staff members found matching "${query}".`
      : 'No staff members found.';
  }
  const lines = staff.map((s: any, idx: number) => {
    const name = `${s.firstName} ${s.lastName}`.trim();
    const role = s.role ? ` [${s.role}]` : '';
    const email = s.email ? ` — ${s.email}` : '';
    return `${idx + 1}. ${name}${role}${email}`;
  });
  const header = query
    ? `Here are matching staff members for "${query}":`
    : 'Here are the staff members:';
  return `${header}\n${lines.join('\n')}`;
};

export const formatPropertyDetails = (p: any) => {
  if (!p) return 'Property not found.';
  const landlord = p.landlord
    ? `\nLandlord: ${p.landlord.firstName} ${p.landlord.lastName}`
    : '';
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
  const tenant = l.tenant
    ? `\nTenant: ${l.tenant.firstName} ${l.tenant.lastName}`
    : '';
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
      .filter(
        ([_, v]) => v !== null && v !== undefined && typeof v !== 'object',
      )
      .map(([k, v]) => `${k}: ${v}`);
    if (detailLines.length > 0) {
      result += `\n\nDetails:\n${detailLines.join('\n')}`;
    }
  }
  return result;
};

export const formatCompanySummary = (data: any) => {
  if (!data) return 'Unable to retrieve company summary.';

  const {
    companyName,
    dateRange,
    properties,
    units,
    tenants,
    activeLeases,
    totals,
  } = data;
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-KE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const period = dateRange?.from && dateRange?.to 
    ? `📅 *Period:* ${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}\n`
    : '';

  return `*COMPANY SUMMARY REPORT: ${companyName || 'General'}*
---------------------------
${period}

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

export const formatTenantStatement = (
  tenant: any,
  invoices: any[],
  payments: any[],
) => {
  if (!tenant) return 'Tenant not found.';

  const overdue = invoices
    .filter((i) => i.status === 'PENDING' && new Date(i.dueDate) < new Date())
    .reduce((acc, i) => acc + i.amount, 0);
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

export const formatPaymentReceipt = (payment: any) => {
  if (!payment) return '💸 Payment recorded successfully.';
  const date = new Date(payment.paidAt).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return `✅ *PAYMENT RECEIVED* 💸
---------------------------
👤 *Tenant:* ${payment.lease?.tenant?.firstName || 'Valued Tenant'}
🏠 *Unit:* ${payment.lease?.unit?.unitNumber || 'N/A'}
💰 *Amount:* *KES ${payment.amount.toLocaleString()}*
📅 *Date:* ${date}
💳 *Method:* ${payment.method}

_Thank you for your payment!_`;
};

export const formatInvoiceSuccess = (invoice: any) => {
  if (!invoice) return '🧾 Invoice created successfully.';
  const date = new Date(invoice.dueDate).toLocaleDateString();
  return `✅ *INVOICE GENERATED* 🧾
---------------------------
👤 *Tenant:* ${invoice.lease?.tenant?.firstName} ${invoice.lease?.tenant?.lastName}
💰 *Amount:* *KES ${invoice.amount.toLocaleString()}*
📅 *Due Date:* ${date}
📝 *Description:* ${invoice.description}

_Sent to tenant via WhatsApp._`;
};

export const formatEntityHistory = (data: any) => {
  if (!data || !data.history || data.history.length === 0) {
    return `📋 No history found for this ${data.entity || 'entity'}.`;
  }

  const lines = data.history.map((h: any, idx: number) => {
    const timestamp = new Date(h.timestamp).toLocaleString('en-KE', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    const actor =
      h.actor?.id === 'SYSTEM'
        ? '⚙️ System'
        : `👤 ${h.actor?.role || 'User'} (${h.actor?.id?.slice(0, 4)})`;
    const actionEmoji =
      h.action === 'CREATE' ? '🆕' : h.action === 'UPDATE' ? '✏️' : '🗑️';

    let diffText = '';
    if (h.action === 'UPDATE' && h.metadata?.diff) {
      const diffs = Object.entries(h.metadata.diff).map(
        ([key, val]: [string, any]) =>
          `   • *${key}*: ${val.old ?? 'null'} → ${val.new ?? 'null'}`,
      );
      if (diffs.length > 0) {
        diffText = `\n${diffs.join('\n')}`;
      }
    } else if (h.action === 'CREATE' && h.metadata?.after) {
      // Show identifying fields for CREATE
      const keys = ['name', 'firstName', 'lastName', 'amount', 'reference', 'status'];
      const details = keys
        .filter((k) => h.metadata.after[k] !== undefined)
        .map((k) => `${k}: ${h.metadata.after[k]}`);
      if (details.length > 0) {
        diffText = `\n   (_${details.join(', ') || 'New record'}_)`;
      }
    }

    return `*${idx + 1}.* ${timestamp} — ${actionEmoji} *${h.action}*\n   By: ${actor}\n   ID: \`${h.id.slice(0, 8)}\`${diffText}`;
  });

  const entityName = data.entity ? data.entity.toUpperCase() : 'ENTITY';
  const total = data.totalChanges || data.history.length;

  return `📜 *VERSION HISTORY: ${entityName}*\n_Recent ${data.history.length} of ${total} entries_\n\n${lines.join('\n\n')}`;
};

export const formatPortfolioHistory = (data: any) => {
  if (!data || !data.history || data.history.length === 0) {
    return '📂 No recent activity found for this portfolio.';
  }

  const lines = data.history.map((h: any, idx: number) => {
    const timestamp = new Date(h.timestamp).toLocaleString('en-KE', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    const entity = h.entity ? `[${h.entity}] ` : '';
    const actionEmoji =
      h.action === 'CREATE' ? '🆕' : h.action === 'UPDATE' ? '✏️' : '🗑️';
    const actor = h.actorId === 'SYSTEM' ? '⚙️' : '👤';

    let diffSummary = '';
    if (h.action === 'UPDATE' && h.metadata?.diff) {
      const fields = Object.keys(h.metadata.diff);
      if (fields.length > 0) {
        diffSummary = `\n   _Changed: ${fields.join(', ')}_`;
      }
    } else if (h.action === 'CREATE' && h.metadata?.after) {
      const name = h.metadata.after.name || h.metadata.after.firstName || '';
      if (name) diffSummary = `\n   _Target: ${name}_`;
    }

    return `*${idx + 1}.* ${timestamp} — ${actionEmoji} ${entity}*${h.action}*\n   By: ${actor} \`${h.id.slice(0, 8)}\`${diffSummary}`;
  });

  const filter = data.entity ? ` (${data.entity})` : '';
  return `🏢 *PORTFOLIO ACTIVITY${filter}*\n_Showing last ${data.history.length} entries_\n\n${lines.join('\n\n')}`;
};

/**
 * Formats a consolidated "Session Diff" for the current AI interaction.
 */
export const formatSessionDiff = (logs: any[]) => {
  if (!logs || logs.length === 0) return '';

  const reportLines = logs.map((h) => {
    const entity = h.entity
      ? h.entity.charAt(0) + h.entity.slice(1).toLowerCase()
      : 'Record';
    
    let header = `📊 **System Change Summary**\n`;
    header += `**${entity} ID:** ${h.targetId || 'N/A'}\n`;
    header += `**Update Time:** ${new Date(h.timestamp).toLocaleString('en-KE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} UTC\n`;

    let detail = '';
    if (h.action === 'UPDATE' && h.metadata?.diff) {
      const changedFields = Object.entries(h.metadata.diff).map(
        ([key, val]: [string, any]) => {
          const oldVal = val.old === null || val.old === undefined ? 'None' : val.old;
          const newVal = val.new === null || val.new === undefined ? 'None' : val.new;
          return `• *Field:* ${key}\n• *Old Value:* ${oldVal}\n• *New Value:* ${newVal}`;
        },
      );
      if (changedFields.length > 0) {
        detail = `\n${changedFields.join('\n\n')}`;
      }
    } else if (h.action === 'CREATE') {
      detail = `\n🆕 *Action:* Created new ${entity} record.`;
    }

    return `${header}${detail}`;
  });

  return `\n\n${reportLines.join('\n\n---\n\n')}\n\n✅ Changes have been successfully recorded in the system audit trail.`;
};
