export const formatPropertyList = (properties: any[]) => {
    if (!properties || properties.length === 0) return 'No properties found.';
    const lines = properties.map((p: any, idx: number) => {
        const address = p.address ? ` — ${p.address}` : '';
        return `${idx + 1}. ${p.name}${address} (ID: ${p.id})`;
    });
    return `Here are your properties:\n${lines.join('\n')}`;
};

export const formatTenantList = (tenants: any[], query: string) => {
    if (!tenants || tenants.length === 0) return `No tenants found matching "${query}".`;
    const lines = tenants.map((t: any, idx: number) => {
        const name = `${t.firstName} ${t.lastName}`.trim();
        const property = t.property?.name ? ` — ${t.property.name}` : '';
        const phone = t.phone ? ` — ${t.phone}` : '';
        return `${idx + 1}. ${name}${property}${phone} (ID: ${t.id})`;
    });
    return `Here are matching tenants:\n${lines.join('\n')}`;
};
