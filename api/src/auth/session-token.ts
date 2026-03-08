import { createHmac, timingSafeEqual } from 'crypto';
export interface SessionTokenPayload {
  userId: string;
  role: string;
  companyId?: string;
  exp: number;
}

const DEV_FALLBACK_SECRET =
  'dev-only-auth-session-secret-change-before-production-32+chars';

let warnedDevFallback = false;

function getSessionSecret(): string {
  const sessionSecret = process.env.AUTH_SESSION_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (sessionSecret && sessionSecret.trim().length >= 32) {
    return sessionSecret;
  }

  if (isProduction) {
    throw new Error(
      'AUTH_SESSION_SECRET must be configured and at least 32 characters long.',
    );
  }

  if (!warnedDevFallback) {
    warnedDevFallback = true;

    console.warn(
      'AUTH_SESSION_SECRET missing/short. Using insecure dev fallback secret. Set AUTH_SESSION_SECRET in .env.',
    );
  }

  return DEV_FALLBACK_SECRET;
}

export function assertSessionSecretConfigured() {
  getSessionSecret();
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(input: string): string {
  return createHmac('sha256', getSessionSecret())
    .update(input)
    .digest('base64url');
}

export function createSessionToken(
  payload: Omit<SessionTokenPayload, 'exp'>,
  ttlSeconds = 60 * 60 * 24 * 7, // 7 days
): string {
  const body: SessionTokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(body));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string): SessionTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [encodedPayload, providedSignature] = parts;
  const expectedSignature = sign(encodedPayload);

  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const decoded = base64UrlDecode(encodedPayload);
    const payload = JSON.parse(decoded) as SessionTokenPayload;

    if (
      !payload.userId ||
      !payload.role ||
      typeof payload.exp !== 'number' ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
