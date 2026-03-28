import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export type PublicShare = {
  id: string;
  agentId: string;
  shareToken: string;
  isActive: boolean;
  hasPassword: boolean;
  guestMessageLimit: number | null;
  expiresAt: string | null;
  conversationCount: number;
  shareCount: number;
  createdAt: string;
};

export type UpdateShareInput = {
  isActive?: boolean;
  guestMessageLimit?: number | null;
  password?: string | null;   // plain text; null removes password
  expiresAt?: string | null;  // ISO date string; null = never expires
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
