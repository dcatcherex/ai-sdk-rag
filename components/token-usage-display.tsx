'use client';

import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CoinsIcon, TrendingUpIcon } from 'lucide-react';
import { useMemo } from 'react';

type TokenUsageRecord = {
  id: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  createdAt: string;
};

type TokenUsageData = {
  records: TokenUsageRecord[];
  totals: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
};

export function TokenUsageDisplay({ threadId }: { threadId: string }) {
  const { data, isLoading } = useQuery<TokenUsageData>({
    queryKey: ['token-usage', threadId],
    queryFn: async () => {
      const response = await fetch(`/api/threads/${threadId}/usage`);
      if (!response.ok) {
        throw new Error('Failed to fetch token usage');
      }
      return response.json();
    },
    enabled: Boolean(threadId),
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  // Estimate cost (rough estimates, adjust based on actual pricing)
  const estimatedCost = useMemo(() => {
    if (!data?.totals) return 0;
    // Rough estimate: $0.02 per 1K tokens (average across models)
    return (data.totals.totalTokens / 1000) * 0.02;
  }, [data]);

  if (!threadId) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <CoinsIcon className="size-4" />
          <span className="hidden sm:inline text-xs">
            {isLoading ? '...' : data?.totals.totalTokens.toLocaleString() ?? '0'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Token Usage</h4>
            <TrendingUpIcon className="size-4 text-muted-foreground" />
          </div>

          {isLoading ? (
            <div className="text-center text-muted-foreground text-sm">
              Loading...
            </div>
          ) : data ? (
            <>
              {/* Totals */}
              <div className="space-y-2 rounded-lg border bg-muted/50 p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Tokens</span>
                  <span className="font-semibold">
                    {data.totals.totalTokens.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Input</span>
                  <span>{data.totals.promptTokens.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Output</span>
                  <span>{data.totals.completionTokens.toLocaleString()}</span>
                </div>
                <div className="mt-2 border-t pt-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Est. Cost</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      ${estimatedCost.toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Recent Usage */}
              {data.records.length > 0 && (
                <div className="space-y-2">
                  <h5 className="font-medium text-xs text-muted-foreground">
                    Recent Activity
                  </h5>
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {data.records.slice(0, 5).map((record) => (
                      <div
                        key={record.id}
                        className="flex items-center justify-between rounded border bg-background p-2 text-xs"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-foreground">
                            {record.totalTokens.toLocaleString()} tokens
                          </span>
                          <span className="text-muted-foreground text-[10px]">
                            {new Date(record.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <span className="truncate text-muted-foreground text-[10px]">
                          {record.model.split('/').pop()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.records.length === 0 && (
                <div className="text-center text-muted-foreground text-sm">
                  No usage data yet
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-muted-foreground text-sm">
              Failed to load usage data
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
