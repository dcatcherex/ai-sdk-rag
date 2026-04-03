'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateGuardrailInput, UpdateGuardrailInput } from '../schema';

export function useGuardrails(brandId: string) {
  return useQuery({
    queryKey: ['guardrails', brandId],
    queryFn: async () => {
      const res = await fetch(`/api/brands/${brandId}/guardrails`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!brandId,
  });
}

export function useSaveGuardrail(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateGuardrailInput & { id?: string }) => {
      const { id, ...payload } = data;
      const url = id
        ? `/api/brands/${brandId}/guardrails/${id}`
        : `/api/brands/${brandId}/guardrails`;
      const method = id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['guardrails', brandId] }),
  });
}

export function useDeleteGuardrail(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (guardrailId: string) => {
      const res = await fetch(`/api/brands/${brandId}/guardrails/${guardrailId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['guardrails', brandId] }),
  });
}

export function useCheckGuardrails() {
  return useMutation({
    mutationFn: async (data: { content: string; brandId: string }) => {
      const res = await fetch('/api/brand-guardrails/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
}
