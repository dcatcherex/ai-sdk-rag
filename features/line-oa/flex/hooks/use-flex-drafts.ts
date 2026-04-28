'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { FlexDraftRecord, SaveFlexDraftInput, UpdateFlexDraftInput } from '../types';

const queryKey = (channelId?: string | null) =>
  channelId ? ['line-flex-drafts', channelId] : ['line-flex-drafts'];

export function useFlexDrafts(channelId?: string | null) {
  return useQuery<FlexDraftRecord[]>({
    queryKey: queryKey(channelId),
    queryFn: async () => {
      const url = channelId
        ? `/api/line-oa/flex-drafts?channelId=${channelId}`
        : '/api/line-oa/flex-drafts';
      const res = await fetch(url);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json() as { drafts: FlexDraftRecord[] };
      return json.drafts;
    },
  });
}

export function useSaveFlexDraft(channelId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveFlexDraftInput) => {
      const res = await fetch('/api/line-oa/flex-drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json() as { draft: FlexDraftRecord }).draft;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKey(channelId) });
      void qc.invalidateQueries({ queryKey: ['line-flex-drafts'] });
    },
  });
}

export function useUpdateFlexDraft(channelId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateFlexDraftInput) => {
      const res = await fetch(`/api/line-oa/flex-drafts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json() as { draft: FlexDraftRecord }).draft;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKey(channelId) });
    },
  });
}

export function useDeleteFlexDraft(channelId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/line-oa/flex-drafts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKey(channelId) });
      void qc.invalidateQueries({ queryKey: ['line-flex-drafts'] });
    },
  });
}
