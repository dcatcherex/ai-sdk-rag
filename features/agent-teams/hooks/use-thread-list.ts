'use client';

import { useQuery } from '@tanstack/react-query';
import type { ThreadItem } from '@/features/chat/types';

export function useThreadList() {
  return useQuery<ThreadItem[]>({
    queryKey: ['threads'],
    queryFn: async () => {
      const res = await fetch('/api/threads');
      if (!res.ok) throw new Error('Failed to load threads');
      const data = (await res.json()) as { threads: ThreadItem[] };
      return data.threads;
    },
    staleTime: 60 * 1000,
  });
}
