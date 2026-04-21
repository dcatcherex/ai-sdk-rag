/** Parse style_reference_urls field (JSON array) with legacy single-URL fallback. */
export function parseStyleUrls(fields: Record<string, string>): string[] {
  const raw = fields['style_reference_urls'];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((u): u is string => typeof u === 'string' && u.startsWith('https://'));
    } catch { /* fall through */ }
  }
  const legacy = fields['style_reference_url'];
  if (legacy?.startsWith('https://')) return [legacy];
  return [];
}
