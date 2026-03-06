import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMediaAssets } from '../utils';
import type { MediaAsset } from '../types';

export const useGalleryAssets = (filter: 'all' | 'image') => {
  const { data = [], isLoading, error } = useQuery<MediaAsset[]>({
    queryKey: ['media-assets', filter],
    queryFn: () => fetchMediaAssets(filter),
  });

  const assets = useMemo(() => data.filter((asset) => asset.type === 'image'), [data]);

  return { assets, isLoading, error };
};
