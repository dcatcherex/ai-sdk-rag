'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ContentPiece, ContentType, ContentStatus } from '../types';

// ── Query Keys ────────────────────────────────────────────────────────────────

export const contentPieceKeys = {
  all: ['content-pieces'] as const,
  list: (filters?: Record<string, string>) =>
    ['content-pieces', 'list', filters ?? {}] as const,
  detail: (id: string) => ['content-pieces', 'detail', id] as const,
};

// ── Fetch Helpers ─────────────────────────────────────────────────────────────

async function fetchContentPieces(filters?: {
  contentType?: ContentType;
  status?: ContentStatus;
  brandId?: string;
}): Promise<ContentPiece[]> {
  const params = new URLSearchParams();
  if (filters?.contentType) params.set('contentType', filters.contentType);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.brandId) params.set('brandId', filters.brandId);

  const res = await fetch(`/api/content-pieces?${params.toString()}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<ContentPiece[]>;
}

async function fetchContentPiece(id: string): Promise<ContentPiece> {
  const res = await fetch(`/api/content-pieces/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<ContentPiece>;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useContentPieces(filters?: {
  contentType?: ContentType;
  status?: ContentStatus;
  brandId?: string;
}) {
  return useQuery({
    queryKey: contentPieceKeys.list(filters as Record<string, string> | undefined),
    queryFn: () => fetchContentPieces(filters),
  });
}

export function useContentPiece(id: string) {
  return useQuery({
    queryKey: contentPieceKeys.detail(id),
    queryFn: () => fetchContentPiece(id),
    enabled: Boolean(id),
  });
}

export function useSaveContentPiece() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<ContentPiece> & { id?: string }) => {
      const { id, ...body } = data;
      const res = id
        ? await fetch(`/api/content-pieces/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/content-pieces', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<ContentPiece>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contentPieceKeys.all });
    },
  });
}

export function useDeleteContentPiece() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/content-pieces/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contentPieceKeys.all });
    },
  });
}
