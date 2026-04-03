'use client';

import { useState } from 'react';
import { BarChart2Icon, BrainIcon, Loader2Icon, TrendingUpIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useContentSummary, useAnalyzePerformance } from '../hooks/use-analytics';

const PLATFORM_COLORS: Record<string, string> = {
  linkedin: 'bg-blue-500',
  twitter: 'bg-sky-400',
  email: 'bg-green-500',
  blog: 'bg-orange-500',
  instagram: 'bg-pink-500',
  facebook: 'bg-blue-700',
  other: 'bg-gray-400',
};

type Props = { contentPieceId: string };

export function PerformanceSummary({ contentPieceId }: Props) {
  const { data: summary, isLoading } = useContentSummary(contentPieceId);
  const { data: analysis, isFetching: analyzing, refetch: runAnalysis } = useAnalyzePerformance(contentPieceId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2Icon className="size-4 animate-spin" />
        Loading metrics…
      </div>
    );
  }

  if (!summary || summary.metrics.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No metrics logged yet. Click &quot;Log metrics&quot; to record performance data.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Totals */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {[
          { label: 'Views', value: summary.totalViews },
          { label: 'Impressions', value: summary.totalImpressions },
          { label: 'Clicks', value: summary.totalClicks },
          { label: 'Engagement', value: summary.totalEngagement },
          { label: 'Conversions', value: summary.totalConversions },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg border border-black/5 dark:border-border bg-muted/30 p-2.5 text-center"
          >
            <p className="text-lg font-semibold">{value.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {summary.avgCtr != null && (
        <p className="flex items-center gap-1.5 text-sm">
          <TrendingUpIcon className="size-3.5 text-green-500" />
          Avg CTR: <strong>{(summary.avgCtr * 100).toFixed(2)}%</strong>
        </p>
      )}

      {/* By Platform */}
      {summary.byPlatform.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">By Platform</p>
          {summary.byPlatform.map((p) => (
            <div key={p.platform} className="flex items-center gap-2 text-sm">
              <span
                className={`size-2 rounded-full shrink-0 ${PLATFORM_COLORS[p.platform] ?? 'bg-gray-400'}`}
              />
              <span className="w-20 capitalize">{p.platform}</span>
              <span className="text-muted-foreground">{p.views} views · {p.clicks} clicks · {p.engagement} eng</span>
            </div>
          ))}
        </div>
      )}

      {/* AI Analysis */}
      <div className="border-t border-black/5 dark:border-border pt-3">
        <Button
          size="sm"
          variant="outline"
          onClick={() => runAnalysis()}
          disabled={analyzing}
          className="gap-1.5"
        >
          <BrainIcon className="size-3.5" />
          {analyzing ? 'Analyzing…' : 'AI Performance Analysis'}
        </Button>

        {analysis && (
          <div className="mt-3 space-y-3 rounded-lg border border-black/5 dark:border-border bg-muted/20 p-3">
            <div className="flex items-center gap-2">
              <BarChart2Icon className="size-4 text-primary" />
              <span className="text-sm font-medium">Performance Score: {analysis.score}/100</span>
            </div>
            <p className="text-sm">{analysis.summary}</p>
            {analysis.topInsights.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium">Key Insights</p>
                <ul className="space-y-0.5">
                  {analysis.topInsights.map((insight, i) => (
                    <li key={i} className="text-xs text-muted-foreground">• {insight}</li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.recommendations.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium">Recommendations</p>
                <ul className="space-y-0.5">
                  {analysis.recommendations.map((rec, i) => (
                    <li key={i} className="text-xs text-muted-foreground">• {rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
