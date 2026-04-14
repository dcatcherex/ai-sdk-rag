'use client';

import { useMutation } from '@tanstack/react-query';
import type {
  AppendSheetRowInput,
  CreateSheetTabInput,
  CreateSpreadsheetInput,
  ReadSheetRangeInput,
  UpdateSheetRangeInput,
} from '@/features/google-sheets/schema';

async function postJson<TInput, TOutput>(url: string, input: TInput): Promise<TOutput> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<TOutput>;
}

export function useReadGoogleSheetRange() {
  return useMutation({
    mutationFn: (input: ReadSheetRangeInput) =>
      postJson('/api/tools/google-sheets/read', input),
  });
}

export function useAppendGoogleSheetRow() {
  return useMutation({
    mutationFn: (input: AppendSheetRowInput) =>
      postJson('/api/tools/google-sheets/append-row', input),
  });
}

export function useUpdateGoogleSheetRange() {
  return useMutation({
    mutationFn: (input: UpdateSheetRangeInput) =>
      postJson('/api/tools/google-sheets/update-range', input),
  });
}

export function useCreateGoogleSheetTab() {
  return useMutation({
    mutationFn: (input: CreateSheetTabInput) =>
      postJson('/api/tools/google-sheets/create-tab', input),
  });
}

export function useCreateGoogleSpreadsheet() {
  return useMutation({
    mutationFn: (input: CreateSpreadsheetInput) =>
      postJson('/api/tools/google-sheets/create-spreadsheet', input),
  });
}
