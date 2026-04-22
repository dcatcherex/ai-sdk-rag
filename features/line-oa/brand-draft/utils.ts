function parseUrlArray(raw: string | undefined, legacySingle?: string): string[] {
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((url): url is string => typeof url === 'string' && url.startsWith('https://'));
      }
    } catch {
      // fall through
    }
  }

  if (legacySingle?.startsWith('https://')) return [legacySingle];
  return [];
}

export function parseLineDraftStyleUrls(fields: Record<string, string>): string[] {
  return parseUrlArray(fields.style_reference_urls, fields.style_reference_url);
}

export function parseLineDraftLogoUrls(fields: Record<string, string>): string[] {
  return parseUrlArray(fields.logo_urls, fields.logo_url);
}
