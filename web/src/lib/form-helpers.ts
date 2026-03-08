export type FormError = string;

type ParseFn = (raw: string) => unknown;

export interface FieldSchema {
  name: string;
  required?: boolean;
  parser: ParseFn;
  sanitize?: (value: string) => string;
  errorMessage?: string;
}

export interface ParsedForm<T extends Record<string, unknown>> {
  values: Partial<T>;
  errors: FormError[];
}

export function sanitizeText(raw: string): string {
  return raw.replace(/<[^>]*>/g, "").trim();
}

export function sanitizeNumber(raw: string): string {
  return raw.replace(/[^0-9.\-]/g, "").trim();
}

export function parseNumber(raw: string): number | undefined {
  if (!raw) {
    return undefined;
  }
  const cleaned = sanitizeNumber(raw);
  if (cleaned === "" || cleaned === "-" || cleaned === ".") {
    return undefined;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseFloatValue(raw: string): number | undefined {
  return parseNumber(raw);
}

export function parseText(raw: string): string | undefined {
  const cleaned = sanitizeText(raw);
  return cleaned || undefined;
}

export function parseDate(raw: string): string | undefined {
  const sanitized = sanitizeText(raw);
  if (!sanitized) return undefined;
  const date = new Date(sanitized);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function parseForm<T extends Record<string, unknown>>(
  schema: FieldSchema[],
  formData: FormData,
): ParsedForm<T> {
  const values = {} as Partial<T>;
  const errors: FormError[] = [];

  for (const field of schema) {
    const rawEntry = formData.get(field.name);
    const rawValue = typeof rawEntry === "string" ? rawEntry : "";
    const cleaned = field.sanitize ? field.sanitize(rawValue) : sanitizeText(rawValue);

    if (!cleaned) {
      if (field.required) {
        errors.push(field.errorMessage ?? `Missing required field: ${field.name}`);
      }
      values[field.name as keyof T] = undefined;
      continue;
    }

    const parsed = field.parser(cleaned);
    if (parsed === undefined) {
      errors.push(field.errorMessage ?? `Invalid value for ${field.name}`);
      values[field.name as keyof T] = undefined;
      continue;
    }

    values[field.name as keyof T] = parsed as T[keyof T];
  }

  return { values, errors };
}
