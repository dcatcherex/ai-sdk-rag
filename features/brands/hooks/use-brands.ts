'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Brand, BrandAsset, BrandIcp, BrandIcpInput, BrandImportJson, BrandSharedUser } from '../types';

export const brandKeys = {
  all: ['brands'] as const,
  assets: (brandId: string) => ['brands', brandId, 'assets'] as const,
  stats: (brandId: string) => ['brands', brandId, 'stats'] as const,
  icps: (brandId: string) => ['brands', brandId, 'icps'] as const,
};

export function useBrands() {
  return useQuery({
    queryKey: brandKeys.all,
    queryFn: async () => {
      const res = await fetch('/api/brands');
      if (!res.ok) throw new Error('Failed to fetch brands');
      return res.json() as Promise<Brand[]>;
    },
  });
}

export function useBrandAssets(brandId: string) {
  return useQuery({
    queryKey: brandKeys.assets(brandId),
    queryFn: async () => {
      const res = await fetch(`/api/brands/${brandId}/assets`);
      if (!res.ok) throw new Error('Failed to fetch assets');
      return res.json() as Promise<BrandAsset[]>;
    },
  });
}

export function useDeleteBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/brands/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete brand');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: brandKeys.all }),
  });
}

export function useSetDefaultBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/brands/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _action: 'setDefault' }),
      });
      if (!res.ok) throw new Error('Failed to set default brand');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: brandKeys.all }),
  });
}

export function useImportBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (json: BrandImportJson) => {
      const res = await fetch('/api/brands/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      });
      if (!res.ok) throw new Error('Import failed. Please try again.');
      return res.json() as Promise<Brand>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: brandKeys.all }),
  });
}

export function useSaveBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      brandId,
      payload,
    }: {
      brandId: string | null;
      payload: Record<string, unknown>;
    }) => {
      const url = brandId ? `/api/brands/${brandId}` : '/api/brands';
      const method = brandId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save. Please try again.');
      return res.json() as Promise<Brand>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: brandKeys.all }),
  });
}

export function useUploadBrandAsset(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fd: FormData) => {
      const res = await fetch(`/api/brands/${brandId}/assets`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      return res.json() as Promise<BrandAsset>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: brandKeys.assets(brandId) }),
  });
}

export type BrandStats = {
  threadCount: number;
  recentThreads: { id: string; title: string; updatedAt: string }[];
};

export function useBrandStats(brandId: string) {
  return useQuery({
    queryKey: brandKeys.stats(brandId),
    queryFn: async () => {
      const res = await fetch(`/api/brands/${brandId}/stats`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json() as Promise<BrandStats>;
    },
  });
}

export function useAddBrandShare(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/brands/${brandId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const { error } = await res.json() as { error: string };
        throw new Error(error ?? 'Failed to share');
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: brandKeys.all }),
  });
}

export function useRemoveBrandShare(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/brands/${brandId}/share`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error('Failed to remove share');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: brandKeys.all }),
  });
}

export function useBrandShareSearch(query: string) {
  return useQuery({
    queryKey: ['users', 'search', query],
    queryFn: async () => {
      if (query.trim().length < 2) return [] as BrandSharedUser[];
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) return [] as BrandSharedUser[];
      return res.json() as Promise<BrandSharedUser[]>;
    },
    enabled: query.trim().length >= 2,
  });
}

export function useDeleteBrandAsset(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assetId: string) => {
      const res = await fetch(`/api/brands/${brandId}/assets/${assetId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: brandKeys.assets(brandId) }),
  });
}

// ── ICP hooks ─────────────────────────────────────────────────────────────────

export function useIcps(brandId: string) {
  return useQuery({
    queryKey: brandKeys.icps(brandId),
    queryFn: async () => {
      const res = await fetch(`/api/brands/${brandId}/icps`);
      if (!res.ok) throw new Error('Failed to fetch ICPs');
      return res.json() as Promise<BrandIcp[]>;
    },
    enabled: Boolean(brandId),
  });
}

export function useSaveIcp(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ icpId, data }: { icpId?: string; data: BrandIcpInput }) => {
      const url = icpId ? `/api/brands/${brandId}/icps/${icpId}` : `/api/brands/${brandId}/icps`;
      const method = icpId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save ICP');
      return res.json() as Promise<BrandIcp>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: brandKeys.icps(brandId) }),
  });
}

export function useDeleteIcp(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (icpId: string) => {
      const res = await fetch(`/api/brands/${brandId}/icps/${icpId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete ICP');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: brandKeys.icps(brandId) }),
  });
}
