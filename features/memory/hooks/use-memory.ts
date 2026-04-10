'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  BrandMemoryListResponse,
  BrandMemoryRecord,
  ThreadWorkingMemoryRecord,
} from '@/features/memory/types';

export const memoryKeys = {
  brand: (brandId: string) => ['brands', brandId, 'memory'] as const,
  thread: (threadId: string) => ['threads', threadId, 'working-memory'] as const,
};

export function useBrandMemory(brandId: string) {
  return useQuery({
    queryKey: memoryKeys.brand(brandId),
    queryFn: async () => {
      const response = await fetch(`/api/brands/${brandId}/memory`);
      if (!response.ok) throw new Error('Failed to load brand memory');
      return response.json() as Promise<BrandMemoryListResponse>;
    },
    enabled: Boolean(brandId),
  });
}

export function useCreateBrandMemory(brandId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { title: string; category?: string | null; content: string }) => {
      const response = await fetch(`/api/brands/${brandId}/memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to create memory');
      return response.json() as Promise<BrandMemoryRecord>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: memoryKeys.brand(brandId) });
    },
  });
}

export function useUpdateBrandMemory(brandId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { memoryId: string; title: string; category?: string | null; content: string }) => {
      const response = await fetch(`/api/brands/${brandId}/memory/${payload.memoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: payload.title,
          category: payload.category,
          content: payload.content,
        }),
      });

      if (!response.ok) throw new Error('Failed to update memory');
      return response.json() as Promise<BrandMemoryRecord>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: memoryKeys.brand(brandId) });
    },
  });
}

export function useDeleteBrandMemory(brandId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memoryId: string) => {
      const response = await fetch(`/api/brands/${brandId}/memory/${memoryId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete memory');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: memoryKeys.brand(brandId) });
    },
  });
}

function useBrandMemoryActionMutation(
  brandId: string,
  action: 'approve' | 'reject' | 'archive',
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memoryId: string) => {
      const response = await fetch(`/api/brands/${brandId}/memory/${memoryId}/${action}`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error(`Failed to ${action} memory`);
      return response.json() as Promise<BrandMemoryRecord>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: memoryKeys.brand(brandId) });
    },
  });
}

export function useApproveBrandMemory(brandId: string) {
  return useBrandMemoryActionMutation(brandId, 'approve');
}

export function useRejectBrandMemory(brandId: string) {
  return useBrandMemoryActionMutation(brandId, 'reject');
}

export function useArchiveBrandMemory(brandId: string) {
  return useBrandMemoryActionMutation(brandId, 'archive');
}

export function useThreadWorkingMemory(threadId: string | null | undefined) {
  return useQuery({
    queryKey: memoryKeys.thread(threadId ?? ''),
    queryFn: async () => {
      const response = await fetch(`/api/threads/${threadId}/working-memory`);
      if (!response.ok) throw new Error('Failed to load thread working memory');
      const payload = (await response.json()) as { workingMemory: ThreadWorkingMemoryRecord | null };
      return payload.workingMemory;
    },
    enabled: Boolean(threadId),
  });
}

export function useRefreshThreadWorkingMemory(threadId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!threadId) return null;

      const response = await fetch(`/api/threads/${threadId}/working-memory/refresh`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to refresh thread working memory');
      const payload = (await response.json()) as { workingMemory: ThreadWorkingMemoryRecord | null };
      return payload.workingMemory;
    },
    onSuccess: () => {
      if (!threadId) return;
      void queryClient.invalidateQueries({ queryKey: memoryKeys.thread(threadId) });
    },
  });
}

export function useClearThreadWorkingMemory(threadId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!threadId) return;

      const response = await fetch(`/api/threads/${threadId}/working-memory`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to clear thread working memory');
    },
    onSuccess: () => {
      if (!threadId) return;
      void queryClient.invalidateQueries({ queryKey: memoryKeys.thread(threadId) });
    },
  });
}
