function escapeReplacement(value: string): string {
  return value.replace(/\$/g, '$$$$');
}

function replaceTemplateString(
  input: string,
  data: Record<string, unknown>,
): string {
  return input.replace(/\{\{([^}]+)\}\}/g, (_match, rawKey) => {
    const key = String(rawKey).trim();
    const value = data[key];
    if (value === null || value === undefined) return '';
    return escapeReplacement(String(value));
  });
}

export function interpolateTemplatePayload<T>(
  payload: T,
  data: Record<string, unknown>,
): T {
  if (typeof payload === 'string') {
    return replaceTemplateString(payload, data) as T;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => interpolateTemplatePayload(item, data)) as T;
  }

  if (payload && typeof payload === 'object') {
    return Object.fromEntries(
      Object.entries(payload as Record<string, unknown>).map(([key, value]) => [
        key,
        interpolateTemplatePayload(value, data),
      ]),
    ) as T;
  }

  return payload;
}

export function readRequiredData(
  data: Record<string, unknown>,
  requiredKeys: string[],
): boolean {
  return requiredKeys.every((key) => {
    const value = data[key];
    if (value === null || value === undefined) return false;
    return String(value).trim().length > 0;
  });
}

export function readTemplateString(
  data: Record<string, unknown>,
  key: string,
  fallback = '',
): string {
  const value = data[key];
  if (value === null || value === undefined) return fallback;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : fallback;
}

export function buildWebCardFields(
  entries: Array<{ label: string; value: unknown }>,
): Array<{ label: string; value: string }> {
  return entries.flatMap((entry) => {
    if (entry.value === null || entry.value === undefined) return [];
    const value = String(entry.value).trim();
    if (!value) return [];
    return [{ label: entry.label, value }];
  });
}
