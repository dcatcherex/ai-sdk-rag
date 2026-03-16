'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { WebsiteRecord } from '../types';

export function useWebsites() {
  return useQuery<{ websites: WebsiteRecord[] }>({
    queryKey: ['websites'],
    queryFn: async () => {
      const res = await fetch('/api/website-builder');
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
}

export function useWebsite(id: string | null) {
  return useQuery<{ website: WebsiteRecord }>({
    queryKey: ['website', id],
    queryFn: async () => {
      const res = await fetch(`/api/website-builder/${id}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!id,
  });
}

export function useDeleteWebsite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/website-builder/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['websites'] });
    },
  });
}
