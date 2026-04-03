'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DistributionRecord, SendEmailInput, ExportInput, ExportResult } from '../types';

const distKeys = {
  all: (userId?: string) => ['distribution', userId] as const,
  byContent: (contentPieceId: string) => ['distribution', 'content', contentPieceId] as const,
};

export function useDistributionRecords(contentPieceId?: string) {
  return useQuery<DistributionRecord[]>({
    queryKey: contentPieceId ? distKeys.byContent(contentPieceId) : distKeys.all(),
    queryFn: async () => {
      const params = contentPieceId ? `?contentPieceId=${contentPieceId}` : '';
      const res = await fetch(`/api/distribution${params}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
}

export function useSendEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SendEmailInput) => {
      const res = await fetch('/api/distribution/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<DistributionRecord>;
    },
    onSuccess: (_, vars) => {
      if (vars.contentPieceId) {
        qc.invalidateQueries({ queryKey: distKeys.byContent(vars.contentPieceId) });
      }
      qc.invalidateQueries({ queryKey: distKeys.all() });
    },
  });
}

export function useExportContent() {
  return useMutation({
    mutationFn: async (input: ExportInput): Promise<ExportResult> => {
      const res = await fetch('/api/distribution/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
}

export function useSendWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { contentPieceId: string; webhookUrl: string }) => {
      const res = await fetch('/api/distribution/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<DistributionRecord>;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: distKeys.byContent(vars.contentPieceId) });
    },
  });
}
