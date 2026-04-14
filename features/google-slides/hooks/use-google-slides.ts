'use client';

import { useMutation } from '@tanstack/react-query';
import type {
  CreateGoogleSlidesDeckInput,
  CreateGoogleSlidesFromTemplateInput,
} from '@/features/google-slides/schema';

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

export function useCreateGoogleSlidesDeck() {
  return useMutation({
    mutationFn: (input: CreateGoogleSlidesDeckInput) =>
      postJson('/api/tools/google-slides/create-deck', input),
  });
}

export function useCreateGoogleSlidesFromTemplate() {
  return useMutation({
    mutationFn: (input: CreateGoogleSlidesFromTemplateInput) =>
      postJson('/api/tools/google-slides/create-from-template', input),
  });
}
