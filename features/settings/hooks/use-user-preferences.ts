'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Preferences } from '../types';

export const USER_PREFERENCES_QUERY_KEY = ['user-preferences'] as const;

const DEFAULT_PREFS: Preferences = {
  memoryEnabled: true,
  memoryInjectEnabled: true,
  memoryExtractEnabled: true,
  promptEnhancementEnabled: true,
  followUpSuggestionsEnabled: true,
  enabledToolIds: null,
  pinnedWorkspaceItemIds: null,
  hiddenWorkspaceItemIds: null,
  rerankEnabled: false,
  selectedVoice: null,
};

async function fetchPreferences(): Promise<Preferences> {
  const response = await fetch('/api/user/preferences');
  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = (await response.json()) as Partial<Preferences>;
  return { ...DEFAULT_PREFS, ...data };
}

async function putPreferences(patch: Partial<Preferences>): Promise<void> {
  const response = await fetch('/api/user/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

export function useUserPreferences() {
  const queryClient = useQueryClient();

  const query = useQuery<Preferences>({
    queryKey: USER_PREFERENCES_QUERY_KEY,
    queryFn: fetchPreferences,
  });

  const mutation = useMutation({
    mutationFn: putPreferences,
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: USER_PREFERENCES_QUERY_KEY });

      const previous = queryClient.getQueryData<Preferences>(USER_PREFERENCES_QUERY_KEY);
      const next = { ...(previous ?? DEFAULT_PREFS), ...patch };
      queryClient.setQueryData(USER_PREFERENCES_QUERY_KEY, next);

      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) {
        queryClient.setQueryData(USER_PREFERENCES_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: USER_PREFERENCES_QUERY_KEY });
    },
  });

  return {
    prefs: query.data ?? DEFAULT_PREFS,
    updatePref: mutation.mutateAsync,
    isLoading: query.isLoading,
    isUpdating: mutation.isPending,
  };
}
