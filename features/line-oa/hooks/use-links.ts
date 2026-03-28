'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type AccountLink = {
  id: string;
  userId: string;
  channelId: string;
  lineUserId: string;
  displayName: string | null;
  pictureUrl: string | null;
  linkedAt: string;
};

export type GeneratedToken = {
  token: string;
  expiresAt: string;
};

const queryKey = (channelId: string) => ['line-links', channelId];

export function useAccountLinks(channelId: string) {
  return useQuery<AccountLink[]>({
    queryKey: queryKey(channelId),
    queryFn: async () => {
      const res = await fetch(`/api/line-oa/${channelId}/links`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
}

export function useGenerateLinkToken(channelId: string) {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/line-oa/${channelId}/links`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<GeneratedToken>;
    },
  });
}

export function useDeleteLink(channelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (linkId: string) => {
      const res = await fetch(`/api/line-oa/${channelId}/links/${linkId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(channelId) }),
  });
}

export function usePushToLink(channelId: string) {
  return useMutation({
    mutationFn: async ({ linkId, messageText }: { linkId: string; messageText: string }) => {
      const res = await fetch(`/api/line-oa/${channelId}/links/${linkId}/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageText }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
}
