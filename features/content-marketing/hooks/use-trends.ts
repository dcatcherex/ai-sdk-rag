'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { SocialPlatform, TrendPlatform, TrendItem, GetTrendsResult } from '../types';

type UseTrendsOptions = {
  onUseTrend: (data: { platform: SocialPlatform; topic: string }) => void;
  setNotification: (n: { type: 'success' | 'error'; message: string } | null) => void;
};

export function useTrends({ onUseTrend, setNotification }: UseTrendsOptions) {
  const [trendPlatform, setTrendPlatform] = useState<TrendPlatform | 'all'>('all');
  const [trendIndustry, setTrendIndustry] = useState<string>('all');
  const [trendRefreshing, setTrendRefreshing] = useState(false);

  const { data: trendsData, isLoading: trendsLoading, refetch: refetchTrends } = useQuery({
    queryKey: ['social-trends', trendPlatform, trendIndustry],
    queryFn: async () => {
      const params = new URLSearchParams({ industry: trendIndustry });
      if (trendPlatform !== 'all') params.set('platform', trendPlatform);
      const res = await fetch(`/api/tools/content-marketing/trends?${params}`);
      if (!res.ok) throw new Error('Failed to load trends');
      return res.json() as Promise<GetTrendsResult>;
    },
    staleTime: 1000 * 60 * 60,
  });

  const onDemandRefresh = async () => {
    setTrendRefreshing(true);
    try {
      const params: Record<string, string> = { industry: trendIndustry };
      if (trendPlatform !== 'all') params.platform = trendPlatform;
      const res = await fetch('/api/tools/content-marketing/trends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (res.status === 402) {
        const data = (await res.json()) as { error: string; required: number; balance: number };
        setNotification({ type: 'error', message: `${data.error}. Need ${data.required} credits, have ${data.balance}.` });
        return;
      }
      if (!res.ok) throw new Error('Refresh failed');
      await refetchTrends();
      setNotification({ type: 'success', message: 'Trends refreshed!' });
    } catch {
      setNotification({ type: 'error', message: 'Trend refresh failed. Please try again.' });
    } finally {
      setTrendRefreshing(false);
    }
  };

  const handleUseTrend = (trend: TrendItem) => {
    const platform: SocialPlatform = trend.platform === 'tiktok' ? 'tiktok' : 'instagram';
    onUseTrend({ platform, topic: `${trend.title} — ${trend.description}` });
  };

  return {
    trendPlatform, setTrendPlatform,
    trendIndustry, setTrendIndustry,
    trendRefreshing,
    trendsData,
    trendsLoading,
    onDemandRefresh,
    handleUseTrend,
  };
}
