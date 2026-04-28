'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { BroadcastStatus, BroadcastTargetType, BroadcastMessageType } from '@/db/schema';

export type { BroadcastStatus, BroadcastTargetType, BroadcastMessageType };

export type BroadcastRecord = {
  id: string;
  channelId: string;
  name: string;
  targetType: BroadcastTargetType;
  messageType: BroadcastMessageType;
  messageText: string | null;
  messagePayload: Record<string, unknown> | null;
  status: BroadcastStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  recipientCount: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateBroadcastInput = {
  name: string;
  messageText: string;
  messageType?: 'text' | 'flex';
  messagePayload?: Record<string, unknown>;
};

export type UpdateBroadcastInput = {
  id: string;
  name?: string;
  messageText?: string;
  messageType?: 'text' | 'flex';
  messagePayload?: Record<string, unknown>;
};

const queryKey = (channelId: string) => ['line-broadcasts', channelId];

export function useBroadcasts(channelId: string) {
  return useQuery<BroadcastRecord[]>({
    queryKey: queryKey(channelId),
    queryFn: async () => {
      const res = await fetch(`/api/line-oa/${channelId}/broadcasts`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
}

export function useCreateBroadcast(channelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBroadcastInput) => {
      const res = await fetch(`/api/line-oa/${channelId}/broadcasts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<BroadcastRecord>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(channelId) }),
  });
}

export function useUpdateBroadcast(channelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateBroadcastInput) => {
      const res = await fetch(`/api/line-oa/${channelId}/broadcasts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(channelId) }),
  });
}

export function useDeleteBroadcast(channelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (broadcastId: string) => {
      const res = await fetch(`/api/line-oa/${channelId}/broadcasts/${broadcastId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(channelId) }),
  });
}

export function useSendBroadcast(channelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (broadcastId: string) => {
      const res = await fetch(`/api/line-oa/${channelId}/broadcasts/${broadcastId}/send`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ recipientCount: number | null }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(channelId) }),
  });
}
