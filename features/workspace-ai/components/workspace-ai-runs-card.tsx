'use client';

import { BotIcon, ImageIcon, Loader2Icon, RefreshCwIcon, SparklesIcon, TextCursorInputIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useWorkspaceAiRuns } from '../hooks/use-workspace-ai-runs';
import type { WorkspaceAiRunListItem, WorkspaceAiRunStatus } from '../types';

type WorkspaceAiRunsCardProps = {
  limit?: number;
  className?: string;
  title?: string;
  description?: string;
};

const statusBadgeVariant: Record<WorkspaceAiRunStatus, 'secondary' | 'destructive' | 'outline'> = {
  success: 'secondary',
  error: 'destructive',
  pending: 'outline',
};

function formatKind(kind: string) {
  return kind.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function SummaryChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function RunRouteIcon({ route }: { route: WorkspaceAiRunListItem['route'] }) {
  if (route === 'image') return <ImageIcon className="size-3.5" />;
  return <TextCursorInputIcon className="size-3.5" />;
}

function RunRow({ run }: { run: WorkspaceAiRunListItem }) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            <RunRouteIcon route={run.route} />
            <span>{formatKind(run.kind)}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {run.entityType}
            {run.entityId ? ` - ${run.entityId}` : ''}
          </div>
        </div>
        <Badge variant={statusBadgeVariant[run.status]} className="capitalize">
          {run.status}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>{formatDate(run.createdAt)}</span>
        <span className="capitalize">- {run.route}</span>
        {run.modelId ? <span>- {run.modelId}</span> : null}
      </div>

      {run.errorMessage ? (
        <div className="text-xs text-destructive">{run.errorMessage}</div>
      ) : null}
    </div>
  );
}

export function WorkspaceAiRunsCard({
  limit = 10,
  className,
  title = 'Workspace AI activity',
  description = 'Recent assist runs and summary counts for the current user.',
}: WorkspaceAiRunsCardProps) {
  const { data, isLoading, isFetching, error, refetch } = useWorkspaceAiRuns(limit);

  return (
    <Card className={cn('gap-4', className)}>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <BotIcon className="size-4" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            {isFetching ? <Loader2Icon className="size-3.5 animate-spin" /> : <RefreshCwIcon className="size-3.5" />}
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Loading workspace AI activity...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-4 text-sm text-destructive">
            {error instanceof Error ? error.message : 'Failed to load workspace AI activity.'}
          </div>
        ) : data ? (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <SummaryChip label="Total runs" value={data.summary.totalRuns} />
              <SummaryChip label="Successful" value={data.summary.successCount} />
              <SummaryChip label="Errors" value={data.summary.errorCount} />
              <SummaryChip label="Pending" value={data.summary.pendingCount} />
            </div>

            <div className="flex flex-wrap gap-2">
              {data.summary.byKind.map((item) => (
                <Badge key={item.key} variant="outline" className="gap-1.5">
                  <SparklesIcon className="size-3" />
                  {formatKind(item.key)}: {item.count}
                </Badge>
              ))}
            </div>

            <Separator />

            {data.runs.length === 0 ? (
              <div className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
                No workspace AI runs yet.
              </div>
            ) : (
              <ScrollArea className="max-h-96 pr-3">
                <div className="space-y-3">
                  {data.runs.map((run) => (
                    <RunRow key={run.id} run={run} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
