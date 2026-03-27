'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateLineOaChannelInput, LineOaChannel, UpdateLineOaChannelInput } from '../types';

const QUERY_KEY = ['line-oa-channels'] as const;

export const useLineOaChannels = () =>
  useQuery<LineOaChannel[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch('/api/line-oa');
      if (!res.ok) throw new Error('Failed to load LINE OA channels');
      const data = (await res.json()) as { channels: LineOaChannel[] };
      return data.channels;
    },
    staleTime: 5 * 60 * 1000,
  });

export const useCreateLineOaChannel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateLineOaChannelInput) => {
      const res = await fetch('/api/line-oa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { channel: LineOaChannel };
      return data.channel;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
};

export const useUpdateLineOaChannel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateLineOaChannelInput & { id: string }) => {
      const res = await fetch(`/api/line-oa/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { channel: LineOaChannel };
      return data.channel;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
};

export const useDeleteLineOaChannel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/line-oa/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
};
