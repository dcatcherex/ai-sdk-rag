import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { availableModels } from '@/lib/ai';

const QUERY_KEY = ['user-enabled-models'] as const;
const ALL_MODEL_IDS = availableModels.map((m) => m.id);

type EnabledModelsResponse = {
  enabledModelIds: string[];
  adminEnabledModelIds: string[];
};

async function fetchEnabledModels(): Promise<EnabledModelsResponse> {
  const res = await fetch('/api/user/enabled-models');
  if (res.status === 401) return { enabledModelIds: ALL_MODEL_IDS, adminEnabledModelIds: ALL_MODEL_IDS };
  if (!res.ok) throw new Error('Failed to load model preferences');
  return res.json() as Promise<EnabledModelsResponse>;
}

async function saveEnabledModelIds(ids: string[]): Promise<EnabledModelsResponse> {
  const res = await fetch('/api/user/enabled-models', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabledModelIds: ids }),
  });
  if (!res.ok) throw new Error('Failed to save model preferences');
  return res.json() as Promise<EnabledModelsResponse>;
}

export function useEnabledModels() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchEnabledModels,
    staleTime: 5 * 60 * 1000,
  });

  const enabledModelIds = data?.enabledModelIds ?? ALL_MODEL_IDS;
  const adminEnabledModelIds = data?.adminEnabledModelIds ?? ALL_MODEL_IDS;

  // Models the admin has made available on this platform
  const adminAllowedModels = useMemo(
    () => availableModels.filter((m) => adminEnabledModelIds.includes(m.id)),
    [adminEnabledModelIds]
  );

  const mutation = useMutation({
    mutationFn: saveEnabledModelIds,
    onMutate: async (newIds) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<EnabledModelsResponse>(QUERY_KEY);
      queryClient.setQueryData<EnabledModelsResponse>(QUERY_KEY, (prev) => ({
        enabledModelIds: newIds,
        adminEnabledModelIds: prev?.adminEnabledModelIds ?? ALL_MODEL_IDS,
      }));
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
      const current = queryClient.getQueryData<EnabledModelsResponse>(QUERY_KEY)?.enabledModelIds ?? ALL_MODEL_IDS;
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
    adminAllowedModels,
    isLoading,
    toggleModel,
    setEnabledModelIds,
    isSaving: mutation.isPending,
  };
}
