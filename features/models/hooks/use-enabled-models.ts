import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { availableModels } from '@/lib/ai';

const QUERY_KEY = ['user-enabled-models'] as const;
const ALL_MODEL_IDS = availableModels.map((m) => m.id);

async function fetchEnabledModelIds(): Promise<string[]> {
  const res = await fetch('/api/user/enabled-models');
  if (res.status === 401) return ALL_MODEL_IDS; // unauthenticated fallback
  if (!res.ok) throw new Error('Failed to load model preferences');
  const data = (await res.json()) as { enabledModelIds: string[] };
  return data.enabledModelIds;
}

async function saveEnabledModelIds(ids: string[]): Promise<string[]> {
  const res = await fetch('/api/user/enabled-models', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabledModelIds: ids }),
  });
  if (!res.ok) throw new Error('Failed to save model preferences');
  const data = (await res.json()) as { enabledModelIds: string[] };
  return data.enabledModelIds;
}

export function useEnabledModels() {
  const queryClient = useQueryClient();

  const { data: enabledModelIds = ALL_MODEL_IDS, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchEnabledModelIds,
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: saveEnabledModelIds,
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
      if (next.length === 0) return; // prevent disabling all
      // preserve order from availableModels
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
