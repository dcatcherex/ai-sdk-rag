'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ContentPieceMetric, ContentPerformanceSummary, TrackMetricInput, AbVariant, CreateAbVariantInput, PerformanceAnalysis } from '../types';

const analyticsKeys = {
  metrics: (contentPieceId: string) => ['analytics', 'metrics', contentPieceId] as const,
  summary: (contentPieceId: string) => ['analytics', 'summary', contentPieceId] as const,
  variants: (contentPieceId: string) => ['analytics', 'variants', contentPieceId] as const,
  analysis: (contentPieceId: string) => ['analytics', 'analysis', contentPieceId] as const,
};

// ── Metrics ───────────────────────────────────────────────────────────────────

export function useContentMetrics(contentPieceId: string) {
  return useQuery<ContentPieceMetric[]>({
    queryKey: analyticsKeys.metrics(contentPieceId),
    queryFn: async () => {
      const res = await fetch(`/api/analytics/metrics/${contentPieceId}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!contentPieceId,
  });
}

export function useContentSummary(contentPieceId: string) {
  return useQuery<ContentPerformanceSummary>({
    queryKey: analyticsKeys.summary(contentPieceId),
    queryFn: async () => {
      const res = await fetch(`/api/analytics/metrics/${contentPieceId}/summary`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!contentPieceId,
  });
}

export function useTrackMetric() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TrackMetricInput) => {
      const res = await fetch('/api/analytics/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<ContentPieceMetric>;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: analyticsKeys.metrics(vars.contentPieceId) });
      qc.invalidateQueries({ queryKey: analyticsKeys.summary(vars.contentPieceId) });
    },
  });
}

export function useDeleteMetric(contentPieceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (metricId: string) => {
      const res = await fetch(`/api/analytics/metrics/${contentPieceId}/${metricId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: analyticsKeys.metrics(contentPieceId) });
      qc.invalidateQueries({ queryKey: analyticsKeys.summary(contentPieceId) });
    },
  });
}

// ── AI Analysis ───────────────────────────────────────────────────────────────

export function useAnalyzePerformance(contentPieceId: string) {
  return useQuery<PerformanceAnalysis>({
    queryKey: analyticsKeys.analysis(contentPieceId),
    queryFn: async () => {
      const res = await fetch(`/api/analytics/analyze/${contentPieceId}`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: false, // only run when explicitly triggered
  });
}

// ── A/B Variants ──────────────────────────────────────────────────────────────

export function useAbVariants(contentPieceId: string) {
  return useQuery<AbVariant[]>({
    queryKey: analyticsKeys.variants(contentPieceId),
    queryFn: async () => {
      const res = await fetch(`/api/analytics/variants/${contentPieceId}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!contentPieceId,
  });
}

export function useCreateAbVariant(contentPieceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<CreateAbVariantInput, 'contentPieceId'>) => {
      const res = await fetch('/api/analytics/variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, contentPieceId }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<AbVariant>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: analyticsKeys.variants(contentPieceId) });
    },
  });
}
