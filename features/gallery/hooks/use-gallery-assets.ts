import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMediaAssets } from '../utils';
import type { MediaAsset } from '../types';

export type AssetGroup = {
  rootId: string;
  versions: MediaAsset[]; // sorted oldest → newest
  count: number;
};

export const useGalleryAssets = (filter: 'all' | 'image') => {
  const { data = [], isLoading, error } = useQuery<MediaAsset[]>({
    queryKey: ['media-assets', filter],
    queryFn: () => fetchMediaAssets(filter),
  });

  const assets = useMemo(() => data.filter((asset) => asset.type === 'image'), [data]);

  const assetGroups = useMemo<AssetGroup[]>(() => {
    const groupMap = new Map<string, MediaAsset[]>();
    for (const asset of assets) {
      const key = asset.rootAssetId ?? asset.id;
      const group = groupMap.get(key) ?? [];
      group.push(asset);
      groupMap.set(key, group);
    }
    // Preserve insertion order (most recent group first), sort versions within each group
    return Array.from(groupMap.entries()).map(([rootId, versions]) => ({
      rootId,
      versions: versions.sort((a, b) => (a.version ?? 1) - (b.version ?? 1)),
      count: versions.length,
    }));
  }, [assets]);

  return { assets, assetGroups, isLoading, error };
};
