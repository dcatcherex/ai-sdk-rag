export function getKieCallbackBaseUrl(): string | null {
  const configured =
    process.env.BETTER_AUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL?.trim() ? `https://${process.env.VERCEL_URL.trim()}` : '');

  if (!configured) return null;
  return configured.replace(/\/+$/, '');
}

export function buildKieCallbackUrl(path = '/api/kie/callback'): string | null {
  const baseUrl = getKieCallbackBaseUrl();
  if (!baseUrl) return null;

  const url = new URL(path, `${baseUrl}/`);
  const secret = process.env.KIE_CALLBACK_SECRET?.trim();
  if (secret) {
    url.searchParams.set('token', secret);
  }

  return url.toString();
}

export function isValidKieCallbackToken(token: string | null): boolean {
  const expected = process.env.KIE_CALLBACK_SECRET?.trim();
  if (!expected) return true;
  return token === expected;
}
