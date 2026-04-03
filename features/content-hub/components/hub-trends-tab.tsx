'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TrendCard } from '@/features/content-marketing/components/trend-card';
import { useTrends } from '@/features/content-marketing/hooks/use-trends';
import type { SocialPlatform } from '@/features/content-marketing/types';

type Props = {
  /** Called when user clicks "Use this trend" — navigate to Social with pre-fill */
  onUseTrend: (platform: SocialPlatform, topic: string) => void;
};

export function HubTrendsTab({ onUseTrend }: Props) {
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const {
    trendPlatform, setTrendPlatform,
    trendIndustry, setTrendIndustry,
    trendRefreshing,
    trendsData,
    trendsLoading,
    onDemandRefresh,
    handleUseTrend,
  } = useTrends({
    setNotification,
    onUseTrend: ({ platform, topic }) => onUseTrend(platform, topic),
  });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {notification && (
        <div className={`mx-5 mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
          notification.type === 'success'
            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
        }`}>
          {notification.message}
          <button type="button" onClick={() => setNotification(null)} className="ml-auto opacity-60 hover:opacity-100">×</button>
        </div>
      )}

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Platform</span>
          <div className="flex rounded-md border overflow-hidden text-xs">
            {(['all', 'tiktok', 'instagram', 'youtube'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setTrendPlatform(p)}
                className={`px-3 py-1.5 capitalize transition-colors ${
                  trendPlatform === p
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                {p === 'all' ? 'All' : p === 'tiktok' ? 'TikTok' : p === 'instagram' ? 'Instagram' : 'YouTube'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Industry</span>
          <Select value={trendIndustry} onValueChange={setTrendIndustry}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['all', 'food', 'fitness', 'fashion', 'beauty', 'travel', 'wellness', 'tech', 'ecommerce', 'lifestyle'].map((ind) => (
                <SelectItem key={ind} value={ind} className="text-xs capitalize">
                  {ind === 'all' ? 'All industries' : ind}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {trendsData && (
            <p className="text-[11px] text-muted-foreground">
              {trendsData.isMock ? 'Mock data' : `Week ${trendsData.weekKey}`}
              {' · '}
              {new Date(trendsData.cachedAt).toLocaleDateString()}
            </p>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            onClick={onDemandRefresh}
            disabled={trendRefreshing}
          >
            {trendRefreshing ? <span className="animate-spin">⟳</span> : <span>⟳</span>}
            Refresh
            <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 text-[10px] font-medium">
              5 credits
            </span>
          </Button>
        </div>
      </div>

      {/* Trend cards */}
      <div className="flex-1 overflow-y-auto p-5">
        {trendsLoading ? (
          <div className="flex h-40 items-center justify-center">
            <p className="text-sm text-muted-foreground animate-pulse">Loading trends...</p>
          </div>
        ) : !trendsData?.items.length ? (
          <div className="flex h-40 items-center justify-center">
            <p className="text-sm text-muted-foreground">No trends found. Try a different filter or refresh.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {trendsData.items.map((trend) => (
              <TrendCard
                key={trend.id}
                trend={trend}
                onUse={() => handleUseTrend(trend)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
