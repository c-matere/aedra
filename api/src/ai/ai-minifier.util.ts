/**
 * AiMinifierUtil: Extracts high-signal data for LLM reasoning from raw datasets.
 */

/**
 * minifyRisk: Extracts missed payments, late rates, and trends for default risk analysis.
 */
export function minifyRisk(tenants: any[]): any {
    return {
        flagged_tenants: tenants
            .filter(t => t.missedPayments > 0 || t.lateRate > 0.5)
            .map(t => ({
                unit: t.unitIdentifier || t.unit?.identifier,
                missed: t.missedPayments,
                late_rate: t.lateRate,
                trend: t.paymentTrend, // 'improving' | 'stable' | 'worsening'
            })),
        portfolio_late_rate: tenants.reduce((acc, t) => acc + (t.lateRate || 0), 0) / (tenants.length || 1),
        total_tenants: tenants.length
    };
}

/**
 * minifyFinancials: Summarizes revenue, costs, and collection rates.
 */
export function minifyFinancials(data: { payments: any[], invoices: any[] }): any {
    const totalDue = data.invoices.reduce((acc, inv) => acc + (inv.amount || 0), 0);
    const totalPaid = data.payments.reduce((acc, p) => acc + (p.amount || 0), 0);
    
    return {
        total_invoiced: totalDue,
        total_collected: totalPaid,
        collection_rate: totalDue > 0 ? totalPaid / totalDue : 1,
        anomalies: data.payments.filter(p => p.amount > 500000).length, // high value payments
    };
}

/**
 * minifyYield: Analyzes block-level performance.
 */
export function minifyYield(blocks: any[]): any {
    return blocks.map(b => ({
        block: b.name,
        revenue: b.revenue,
        maintenance_cost: b.maintenanceCost,
        yield: b.revenue - b.maintenanceCost,
        occupancy: b.occupancyRate
    }));
}

/**
 * minifyReportData: Prunes and secures portfolio data for McKinsey reports.
 */
export function minifyReportData(data: any): any {
    if (!data) return {};
    return {
        property: {
            name: data.property?.name,
            address: data.property?.address,
        },
        totals: data.totals,
        maintenance: data.maintenance,
        // Only send top 7 tenants for heatmap analysis to save tokens
        tenantPayments: (data.tenantPayments || [])
            .sort((a: any, b: any) => (a.ltv || 0) - (b.ltv || 0)) // Focus on vulnerable tenants first
            .slice(0, 7)
            .map((t: any) => ({
                name: t.name,
                unit: t.unit,
                payments: t.payments,
                ltv: t.ltv
            })),
        month: data.month,
    };
}
