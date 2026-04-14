'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

type GoogleWorkspaceStatus = {
  configured: boolean;
  connected: boolean;
  account: {
    id: string;
    email: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    scopes: string[];
    tokenExpiresAt: string | Date | null;
    updatedAt: string | Date;
  } | null;
};

const STATUS_KEY = ['google-workspace-status'] as const;

async function fetchStatus(): Promise<GoogleWorkspaceStatus> {
  const response = await fetch('/api/integrations/google/status');
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<GoogleWorkspaceStatus>;
}

async function disconnectGoogleWorkspace(): Promise<void> {
  const response = await fetch('/api/integrations/google/disconnect', {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

export function useGoogleWorkspaceStatus() {
  return useQuery({
    queryKey: STATUS_KEY,
    queryFn: fetchStatus,
  });
}

export function useDisconnectGoogleWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: disconnectGoogleWorkspace,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STATUS_KEY });
    },
  });
}
