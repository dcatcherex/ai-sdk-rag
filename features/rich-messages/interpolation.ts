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
    if (value === null || value === undefined) {
      return '';
    }
    return escapeReplacement(String(value));
  });
}

export function interpolateRichMessageValue<T>(
  value: T,
  data: Record<string, unknown>,
): T {
  if (typeof value === 'string') {
    return replaceTemplateString(value, data) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => interpolateRichMessageValue(item, data)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        interpolateRichMessageValue(nestedValue, data),
      ]),
    ) as T;
  }

  return value;
}
