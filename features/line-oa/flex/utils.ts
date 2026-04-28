/** Parse and pretty-print flex JSON. Returns null if invalid. */
export function parseFlexJson(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/** Validate that a value looks like a FlexContainer (bubble or carousel). */
export function validateFlexPayload(payload: Record<string, unknown>): string | null {
  if (!payload.type) return 'Missing "type" field (expected "bubble" or "carousel")';
  if (payload.type !== 'bubble' && payload.type !== 'carousel') {
    return `Invalid type "${String(payload.type)}" — must be "bubble" or "carousel"`;
  }
  if (payload.type === 'carousel') {
    if (!Array.isArray(payload.contents) || payload.contents.length === 0) {
      return 'Carousel must have a non-empty "contents" array';
    }
  }
  return null;
}

/** Build the LINE Simulator URL for a given FlexContainer JSON. */
export function buildSimulatorUrl(payload: Record<string, unknown>): string {
  const encoded = encodeURIComponent(JSON.stringify(payload, null, 2));
  return `https://developers.line.biz/flex-simulator/?mode=VIEW&payload=${encoded}`;
}

export const FLEX_CATEGORY_LABELS: Record<string, string> = {
  agriculture: 'Agriculture',
  ecommerce: 'E-Commerce',
  general: 'General',
  alert: 'Alert / Notification',
  other: 'Other',
};
