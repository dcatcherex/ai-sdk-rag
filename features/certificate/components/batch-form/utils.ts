import type { CertificateTemplate } from '../../types';
import type { Recipient } from '../../types';

/** Recipient row in the batch form — may carry a group person ID for save-back */
export type BatchRecipient = Recipient & { _groupPersonId?: string };

export type BatchPdfExportMode = 'zip' | 'single_pdf' | 'sheet_pdf';
export const IGNORE_IMPORT_FIELD_ID = '__ignore__' as const;

export type ImportMappedFieldId = string | typeof IGNORE_IMPORT_FIELD_ID;
export type ParsedDelimitedData = {
  headers: string[];
  rows: string[][];
};
export type PendingImportColumn = {
  id: string;
  sourceHeader: string;
  sampleValue: string;
  mappedFieldId: ImportMappedFieldId;
  matchLabel: string;
};
export type PendingImport = {
  columns: PendingImportColumn[];
  rows: string[][];
};

export const PDF_EXPORT_LABELS: Record<BatchPdfExportMode, string> = {
  zip: 'ZIP of PDFs',
  single_pdf: 'One PDF file',
  sheet_pdf: 'A4 3×3 sheet PDF',
};
export const FIELD_IMPORT_ALIASES: Record<string, string[]> = {
  name: ['full name', 'student name', 'legal name'],
  nickname: ['nick name', 'preferred name', 'call name', 'short name'],
};

export function getTemplateInputFields(template: CertificateTemplate): CertificateTemplate['fields'] {
  const map = new Map<string, CertificateTemplate['fields'][number]>();

  [...template.fields, ...template.backFields].forEach((field) => {
    if (!map.has(field.id)) {
      map.set(field.id, field);
    }
  });

  return Array.from(map.values());
}

export function emptyRecipient(fields: CertificateTemplate['fields']): BatchRecipient {
  return { values: Object.fromEntries(fields.map((f) => [f.id, ''])) };
}

export function normalizeColumnName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function splitDelimitedLine(line: string, delimiter: string): string[] {
  return line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ''));
}

export function getFieldImportTokens(field: CertificateTemplate['fields'][number]): string[] {
  const aliasTokens = FIELD_IMPORT_ALIASES[field.id] ?? [];
  return Array.from(new Set([
    normalizeColumnName(field.id),
    normalizeColumnName(field.label),
    ...aliasTokens.map((alias) => normalizeColumnName(alias)),
  ].filter(Boolean)));
}

export function parseDelimitedData(text: string, fields: CertificateTemplate['fields']): ParsedDelimitedData | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  const delimiter = lines[0]?.includes('\t') ? '\t' : ',';
  const fieldLookup = new Set<string>();

  fields.forEach((field) => {
    getFieldImportTokens(field).forEach((token) => {
      fieldLookup.add(token);
    });
  });

  const firstLine = splitDelimitedLine(lines[0], delimiter);
  const normalizedFirstLine = firstLine.map((cell) => normalizeColumnName(cell));
  const hasHeader = normalizedFirstLine.some((cell) => fieldLookup.has(cell));
  const rows = (hasHeader ? lines.slice(1) : lines).map((line) => splitDelimitedLine(line, delimiter));

  if (rows.length === 0) {
    return null;
  }

  return {
    headers: hasHeader ? firstLine : firstLine.map((_, index) => `Column ${index + 1}`),
    rows,
  };
}

export function createPendingImport(data: ParsedDelimitedData, fields: CertificateTemplate['fields']): PendingImport {
  const remainingFieldIds = new Set(fields.map((field) => field.id));
  const fieldIdsByToken = new Map<string, string[]>();

  fields.forEach((field) => {
    getFieldImportTokens(field).forEach((token) => {
      const matches = fieldIdsByToken.get(token) ?? [];
      fieldIdsByToken.set(token, [...matches, field.id]);
    });
  });

  const columns = data.headers.map((header, index) => {
    const normalizedHeader = normalizeColumnName(header);
    const exactMatches = fieldIdsByToken.get(normalizedHeader) ?? [];
    const exactMatch = exactMatches.find((fieldId) => remainingFieldIds.has(fieldId));
    const positionMatch = !exactMatch ? fields[index]?.id : undefined;
    const mappedFieldId = exactMatch ?? positionMatch ?? IGNORE_IMPORT_FIELD_ID;

    if (mappedFieldId !== IGNORE_IMPORT_FIELD_ID) {
      remainingFieldIds.delete(mappedFieldId);
    }

    return {
      id: `${index}-${header}`,
      sourceHeader: header,
      sampleValue: data.rows.find((row) => (row[index] ?? '').trim().length > 0)?.[index] ?? '',
      mappedFieldId,
      matchLabel: exactMatch ? 'Auto-matched by header' : positionMatch ? 'Matched by column order' : 'Ignored by default',
    } satisfies PendingImportColumn;
  });

  return {
    columns,
    rows: data.rows,
  };
}
