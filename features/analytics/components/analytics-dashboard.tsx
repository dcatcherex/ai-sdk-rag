'use client';

import { useState } from 'react';
import { Loader2Icon, PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useContentMetrics, useDeleteMetric } from '../hooks/use-analytics';
import { MetricFormDialog } from './metric-form-dialog';
import { PerformanceSummary } from './performance-summary';
import type { MetricPlatform } from '../types';

const PLATFORM_LABELS: Record<MetricPlatform, string> = {
  linkedin: 'LinkedIn',
  twitter: 'X/Twitter',
  email: 'Email',
  blog: 'Blog',
  instagram: 'Instagram',
  facebook: 'Facebook',
  other: 'Other',
};

type Props = {
  contentPieceId: string;
  contentTitle?: string;
};

export function AnalyticsDashboard({ contentPieceId, contentTitle }: Props) {
  const [showForm, setShowForm] = useState(false);
  const { data: metrics = [], isLoading } = useContentMetrics(contentPieceId);
  const deleteMutation = useDeleteMetric(contentPieceId);

  return (
    <div className="space-y-5">
      {contentTitle && (
        <p className="text-sm font-medium text-muted-foreground">{contentTitle}</p>
      )}

      {/* Summary */}
      <PerformanceSummary contentPieceId={contentPieceId} />

      {/* Metric log */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Metric Log ({metrics.length})
          </p>
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setShowForm(true)}>
            <PlusIcon className="size-3" /> Log metrics
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2Icon className="size-3.5 animate-spin" />
            Loading…
          </div>
        ) : metrics.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No entries yet.</p>
        ) : (
          <div className="space-y-1.5">
            {metrics.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2 rounded-lg border border-black/5 dark:border-border bg-muted/20 px-3 py-2 text-xs"
              >
                <Badge variant="outline" className="text-xs">
                  {PLATFORM_LABELS[m.platform]}
                </Badge>
                <span className="text-muted-foreground">
                  {m.views} views · {m.clicks} clicks · {m.engagement} eng
                </span>
                {m.ctr != null && (
                  <span className="text-muted-foreground">CTR {(m.ctr * 100).toFixed(1)}%</span>
                )}
                <span className="ml-auto text-muted-foreground">
                  {new Date(m.measuredAt).toLocaleDateString()}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-5 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMutation.mutate(m.id)}
                  disabled={deleteMutation.isPending}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <MetricFormDialog
        contentPieceId={contentPieceId}
        open={showForm}
        onOpenChange={setShowForm}
      />
    </div>
  );
}
