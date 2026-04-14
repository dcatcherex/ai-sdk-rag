'use client';

import { useMutation } from '@tanstack/react-query';
import type {
  AppendGoogleDocSectionInput,
  CreateGoogleDocFromTemplateInput,
  CreateGoogleDocInput,
} from '@/features/google-docs/schema';

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

export function useCreateGoogleDoc() {
  return useMutation({
    mutationFn: (input: CreateGoogleDocInput) =>
      postJson('/api/tools/google-docs/create', input),
  });
}

export function useCreateGoogleDocFromTemplate() {
  return useMutation({
    mutationFn: (input: CreateGoogleDocFromTemplateInput) =>
      postJson('/api/tools/google-docs/create-from-template', input),
  });
}

export function useAppendGoogleDocSection() {
  return useMutation({
    mutationFn: (input: AppendGoogleDocSectionInput) =>
      postJson('/api/tools/google-docs/append-section', input),
  });
}
