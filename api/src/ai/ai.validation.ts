export const normalizeEnum = (value: string) =>
    value.trim().toUpperCase().replace(/[\s-]+/g, '_');

export const validateEnum = <T extends string>(
    value: any,
    allowed: readonly T[],
    field: string,
): T | null | { error: string } => {
    if (value === undefined || value === null || value === '') return null;
    const normalized = normalizeEnum(String(value)) as T;
    if (!allowed.includes(normalized)) {
        return { error: `${field} must be one of: ${allowed.join(', ')}` };
    }
    return normalized;
};
