'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SocialPlatform, SocialAccountRecord } from '../types';

export function useAccounts() {
  const queryClient = useQueryClient();

  const { data: accountsData } = useQuery({
    queryKey: ['social-accounts'],
    queryFn: async () => {
      const res = await fetch('/api/social/accounts');
      if (!res.ok) throw new Error('Failed to load accounts');
      return res.json() as Promise<{ accounts: SocialAccountRecord[] }>;
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const res = await fetch(`/api/social/accounts?id=${accountId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Disconnect failed');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['social-accounts'] }),
  });

  const connectedAccounts = accountsData?.accounts ?? [];

  const isConnected = (platform: SocialPlatform) =>
    connectedAccounts.some((a) => a.platform === platform && a.isActive);

  return {
    connectedAccounts,
    isConnected,
    disconnectMutation,
  };
}
