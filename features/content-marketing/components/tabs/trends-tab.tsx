'use client';

import { TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TrendCard } from '../trend-card';
import type { useTrends } from '../../hooks/use-trends';

type Props = {
  trendsState: ReturnType<typeof useTrends>;
};

export function TrendsTab({ trendsState }: Props) {
  const {
    trendPlatform, setTrendPlatform,
    trendIndustry, setTrendIndustry,
    trendRefreshing,
    trendsData,
    trendsLoading,
    onDemandRefresh,
    handleUseTrend,
  } = trendsState;

  return (
    <TabsContent value="trends" className="flex flex-1 flex-col overflow-hidden m-0">
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Filters bar */}
        <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Platform</span>
            <div className="flex rounded-md border overflow-hidden text-xs">
              {(['all', 'tiktok', 'instagram'] as const).map((p) => (
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
                  {p === 'all' ? 'All' : p === 'tiktok' ? 'TikTok' : 'Instagram'}
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
              {trendRefreshing ? (
                <span className="animate-spin">⟳</span>
              ) : (
                <>
                  <span>⟳</span>
                  Refresh
                </>
              )}
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
    </TabsContent>
  );
}
