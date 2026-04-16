'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangleIcon, DatabaseIcon, HardDriveIcon, ServerIcon, SparklesIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AdminUsageResponse, UsageMetric, UsageMetricStatus, UsageProviderKey } from '@/features/admin/usage/types';

const providerIcons: Record<UsageProviderKey, typeof ServerIcon> = {
  vercel: ServerIcon,
  neon: DatabaseIcon,
  r2: HardDriveIcon,
  'internal-ai': SparklesIcon,
};

export function DashboardUsageCard() {
  const { data, isLoading } = useQuery<AdminUsageResponse>({
    queryKey: ['admin', 'usage'],
    queryFn: async () => {
      const res = await fetch('/api/admin/usage');
      if (!res.ok) throw new Error('Failed to fetch usage monitoring data');
      return res.json();
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-base">Infrastructure Usage</CardTitle>
          <p className="text-sm text-muted-foreground">
            Provider limits and internal AI demand over the last {data?.windowDays ?? 7} days
          </p>
        </div>
        {data ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangleIcon className="size-3.5" />
            <span>
              {data.summary.criticalProviders} critical / {data.summary.warningProviders} warning
            </span>
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading usage monitoring…</p>
        ) : data?.providers.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {data.providers.map((provider) => {
              const Icon = providerIcons[provider.provider];
              const mainMetric = pickPrimaryMetric(provider.metrics);
              return (
                <div key={provider.provider} className="rounded-lg border bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">{provider.label}</div>
                        <div className="text-xs text-muted-foreground">
                          Updated {formatRelative(provider.collectedAt)}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className={statusClassName(provider.status)}>
                      {provider.status}
                    </Badge>
                  </div>

                  <div className="mt-3 space-y-1">
                    {mainMetric ? (
                      <>
                        <div className="text-sm text-muted-foreground">{mainMetric.label}</div>
                        <div className="text-xl font-semibold">
                          {formatMetricValue(mainMetric)}
                        </div>
                        {mainMetric.percentOfLimit != null ? (
                          <div className="text-xs text-muted-foreground">
                            {formatPercent(mainMetric.percentOfLimit)} of configured limit
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        {provider.alerts[0]?.message ?? 'No provider metrics available yet.'}
                      </div>
                    )}
                  </div>

                  {provider.alerts.length ? (
                    <div className="mt-3 space-y-1">
                      {provider.alerts.slice(0, 2).map((alert) => (
                        <div key={alert.id} className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{alert.title}:</span> {alert.message}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No usage data available</p>
        )}
      </CardContent>
    </Card>
  );
}

function pickPrimaryMetric(metrics: UsageMetric[]): UsageMetric | null {
  if (!metrics.length) return null;

  const withLimit = metrics.find((metric) => metric.percentOfLimit != null);
  if (withLimit) return withLimit;

  return metrics[0] ?? null;
}

function formatMetricValue(metric: UsageMetric): string {
  switch (metric.unit) {
    case 'bytes':
      return formatBytes(metric.value);
    case 'percent':
      return formatPercent(metric.value);
    case 'tokens':
    case 'credits':
    case 'count':
    case 'requests':
      return metric.value.toLocaleString();
    case 'seconds':
      return formatDuration(metric.value);
    case 'ms':
      return `${metric.value.toLocaleString()} ms`;
    default:
      return metric.value.toLocaleString();
  }
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let next = value / 1024;
  let unitIndex = 0;

  while (next >= 1024 && unitIndex < units.length - 1) {
    next /= 1024;
    unitIndex += 1;
  }

  return `${next.toFixed(next >= 100 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function formatPercent(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

function formatRelative(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function statusClassName(status: UsageMetricStatus): string {
  switch (status) {
    case 'live':
      return 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400';
    case 'partial':
    case 'estimated':
    case 'manual':
      return 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400';
    case 'unavailable':
      return 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';
  }
}
