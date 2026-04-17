'use client';

import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { availableModels } from '@/lib/ai';

const QUERY_KEY = ['admin-enabled-models'] as const;
const ALL_MODEL_IDS = availableModels.map((m) => m.id);

async function fetchAdminEnabledModelIds(): Promise<string[]> {
  const res = await fetch('/api/admin/models');
  if (!res.ok) throw new Error('Failed to load admin model config');
  const data = (await res.json()) as { adminEnabledModelIds: string[] };
  return data.adminEnabledModelIds;
}

async function saveAdminEnabledModelIds(ids: string[]): Promise<string[]> {
  const res = await fetch('/api/admin/models', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminEnabledModelIds: ids }),
  });
  if (!res.ok) throw new Error('Failed to save admin model config');
  const data = (await res.json()) as { adminEnabledModelIds: string[] };
  return data.adminEnabledModelIds;
}

export function useAdminEnabledModels() {
  const queryClient = useQueryClient();

  const { data: enabledModelIds = ALL_MODEL_IDS, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchAdminEnabledModelIds,
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: saveAdminEnabledModelIds,
    onMutate: async (newIds) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<string[]>(QUERY_KEY);
      queryClient.setQueryData<string[]>(QUERY_KEY, newIds);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY, context.previous);
      }
    },
  });

  const toggleModel = useCallback(
    (modelId: string) => {
      const current = queryClient.getQueryData<string[]>(QUERY_KEY) ?? ALL_MODEL_IDS;
      const isEnabled = current.includes(modelId);
      let next = isEnabled ? current.filter((id) => id !== modelId) : [...current, modelId];
      if (next.length === 0) return;
      next = availableModels.filter((m) => next.includes(m.id)).map((m) => m.id);
      mutation.mutate(next);
    },
    [queryClient, mutation]
  );

  const enabledModels = useMemo(
    () => availableModels.filter((m) => enabledModelIds.includes(m.id)),
    [enabledModelIds]
  );

  const setEnabledModelIds = useCallback(
    (ids: string[]) => {
      const next = availableModels.filter((m) => ids.includes(m.id)).map((m) => m.id);
      if (next.length === 0) return;
      mutation.mutate(next);
    },
    [mutation]
  );

  return {
    enabledModelIds,
    enabledModels,
    isLoading,
    toggleModel,
    setEnabledModelIds,
    isSaving: mutation.isPending,
  };
}
