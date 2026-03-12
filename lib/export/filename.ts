export function sanitizeExportFilenamePart(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "document";
}

export function buildPdfFilename(baseName: string, suffix?: string): string {
  const safeBaseName = sanitizeExportFilenamePart(baseName);
  const safeSuffix = suffix ? sanitizeExportFilenamePart(suffix) : null;
  return `${safeBaseName}${safeSuffix ? `_${safeSuffix}` : ""}.pdf`;
}
