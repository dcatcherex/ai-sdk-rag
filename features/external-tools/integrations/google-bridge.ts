import type { NormalizedRunResult, ProviderRunOptions } from '@/features/external-tools/types';

// ── Google Sheets ─────────────────────────────────────────────────────────────

export type GoogleSheetsOperation =
  | 'read-sheet-range'
  | 'append-sheet-row'
  | 'update-sheet-range'
  | 'create-sheet-tab'
  | 'create-spreadsheet';

export function toGoogleSheetsProviderOptions(
  operation: GoogleSheetsOperation,
  input: Record<string, unknown>,
  userId: string,
  threadId?: string | null,
): ProviderRunOptions {
  return {
    toolSlug: 'google-sheets',
    userId,
    threadId: threadId ?? undefined,
    source: 'sidebar',
    input: { operation, ...input },
  };
}

export function fromGoogleSheetsResult(result: NormalizedRunResult): Record<string, unknown> {
  return (result.data ?? {}) as Record<string, unknown>;
}

// ── Google Docs ───────────────────────────────────────────────────────────────

export type GoogleDocsOperation =
  | 'create-doc'
  | 'create-doc-from-template'
  | 'append-doc-section';

export function toGoogleDocsProviderOptions(
  operation: GoogleDocsOperation,
  input: Record<string, unknown>,
  userId: string,
  threadId?: string | null,
): ProviderRunOptions {
  return {
    toolSlug: 'google-docs',
    userId,
    threadId: threadId ?? undefined,
    source: 'sidebar',
    input: { operation, ...input },
  };
}

export function fromGoogleDocsResult(result: NormalizedRunResult): Record<string, unknown> {
  return (result.data ?? {}) as Record<string, unknown>;
}

// ── Google Drive ──────────────────────────────────────────────────────────────

export type GoogleDriveOperation = 'list-files' | 'create-folder' | 'upload-file';

export function toGoogleDriveProviderOptions(
  operation: GoogleDriveOperation,
  input: Record<string, unknown>,
  userId: string,
  threadId?: string | null,
): ProviderRunOptions {
  return {
    toolSlug: 'google-drive',
    userId,
    threadId: threadId ?? undefined,
    source: 'sidebar',
    input: { operation, ...input },
  };
}

export function fromGoogleDriveResult(result: NormalizedRunResult): Record<string, unknown> {
  return (result.data ?? {}) as Record<string, unknown>;
}

// ── Google Slides ─────────────────────────────────────────────────────────────

export type GoogleSlidesOperation = 'create-deck' | 'create-deck-from-template';

export function toGoogleSlidesProviderOptions(
  operation: GoogleSlidesOperation,
  input: Record<string, unknown>,
  userId: string,
  threadId?: string | null,
): ProviderRunOptions {
  return {
    toolSlug: 'google-slides',
    userId,
    threadId: threadId ?? undefined,
    source: 'sidebar',
    input: { operation, ...input },
  };
}

export function fromGoogleSlidesResult(result: NormalizedRunResult): Record<string, unknown> {
  return (result.data ?? {}) as Record<string, unknown>;
}
