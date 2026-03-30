import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export type PublicShare = {
  id: string;
  agentId: string;
  shareToken: string;
  isActive: boolean;
  hasPassword: boolean;
  guestMessageLimit: number | null;
  expiresAt: string | null;
  maxUses: number | null;
  creditLimit: number | null;
  creditsUsed: number;
  conversationCount: number;
  shareCount: number;
  welcomeMessage: string | null;
  createdAt: string;
};

export type UpdateShareInput = {
  isActive?: boolean;
  guestMessageLimit?: number | null;
  password?: string | null;
  expiresAt?: string | null;
  maxUses?: number | null;
  creditLimit?: number | null;
  welcomeMessage?: string | null;
};

const key = (agentId: string) => ['public-share', agentId] as const;

export function usePublicShare(agentId: string) {
  return useQuery<PublicShare | null>({
    queryKey: key(agentId),
    queryFn: async () => {
      const res = await fetch(`/api/agents/${agentId}/public-share`);
      if (!res.ok) throw new Error('Failed to load share');
      const data = await res.json() as { share: PublicShare | null };
      return data.share;
    },
    staleTime: 30_000,
  });
}

export function useCreatePublicShare(agentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/agents/${agentId}/public-share`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create share');
      const data = await res.json() as { share: PublicShare };
      return data.share;
    },
    onSuccess: (share) => qc.setQueryData(key(agentId), share),
  });
}

export function useUpdatePublicShare(agentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateShareInput) => {
      const res = await fetch(`/api/agents/${agentId}/public-share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error('Failed to update share');
      const data = await res.json() as { share: PublicShare };
      return data.share;
    },
    onSuccess: (share) => qc.setQueryData(key(agentId), share),
  });
}

export function useDeletePublicShare(agentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/agents/${agentId}/public-share`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete share');
    },
    onSuccess: () => qc.setQueryData(key(agentId), null),
  });
}

export type DailyStat = {
  day: string;
  views: number;
  chats: number;
  uniqueSessions: number;
};

export type TopMessage = {
  message: string;
  count: number;
};

export type ShareAnalytics = {
  dailyStats: DailyStat[];
  topMessages: TopMessage[];
  totals: { views: number; chats: number; uniqueSessions: number };
};

export function useShareAnalytics(agentId: string, enabled = true) {
  return useQuery<ShareAnalytics>({
    queryKey: ['public-share-analytics', agentId] as const,
    queryFn: async () => {
      const res = await fetch(`/api/agents/${agentId}/public-share/analytics`);
      if (!res.ok) throw new Error('Failed to load analytics');
      return res.json() as Promise<ShareAnalytics>;
    },
    staleTime: 60_000,
    enabled,
  });
}
