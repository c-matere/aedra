export function inferTenantQueryFromMessage(message: string): string | null {
  const raw = (message || '').trim();
  if (!raw) return null;

  // Prefer phone/ID-like digits if present
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length >= 7) return digits;

  // Normalize words
  const normalized = raw
    .toLowerCase()
    .replace(/['"“”‘’]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return null;

  // Strip common intent words around tenant lookups
  const stopwords = new Set([
    'tenant',
    'tenants',
    'profile',
    'profiles',
    'detail',
    'details',
    'info',
    'information',
    'about',
    'for',
    'of',
    'the',
    'a',
    'an',
    'show',
    'view',
    'open',
    'get',
    'fetch',
    'find',
    'search',
    'lookup',
    'check',
    'please',
    'kindly',
  ]);

  const tokens = normalized
    .split(' ')
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !stopwords.has(t));

  if (tokens.length === 0) return null;

  // Heuristic: keep only the first few meaningful tokens (names are usually 2–4 words)
  const candidate = tokens.slice(0, 4).join(' ').trim();
  return candidate.length >= 2 ? candidate : null;
}

