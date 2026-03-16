'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ToolExecutionResult } from '@/features/tools/registry/types';
import type { SiteDataJson } from '../types';

type GenerateResult = ToolExecutionResult<{ websiteId: string; htmlUrl: string; siteData: SiteDataJson }>;
type EditResult = ToolExecutionResult<{ websiteId: string; htmlUrl: string }>;

export function useGenerateWebsite() {
  const queryClient = useQueryClient();
  return useMutation<GenerateResult, Error, { businessDescription: string; templateSlug: string; siteName: string }>({
    mutationFn: async (data) => {
      const res = await fetch('/api/website-builder/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['websites'] });
    },
  });
}

export function useEditWebsite(websiteId: string) {
  const queryClient = useQueryClient();
  return useMutation<EditResult, Error, { editRequest: string }>({
    mutationFn: async ({ editRequest }) => {
      const res = await fetch(`/api/website-builder/${websiteId}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editRequest }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['websites'] });
      queryClient.invalidateQueries({ queryKey: ['website', websiteId] });
    },
  });
}

export function usePublishWebsite() {
  const queryClient = useQueryClient();
  return useMutation<{ liveUrl: string }, Error, { websiteId: string }>({
    mutationFn: async ({ websiteId }) => {
      const res = await fetch(`/api/website-builder/${websiteId}/publish`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (_, { websiteId }) => {
      queryClient.invalidateQueries({ queryKey: ['websites'] });
      queryClient.invalidateQueries({ queryKey: ['website', websiteId] });
    },
  });
}
