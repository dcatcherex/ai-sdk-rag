'use client';

import { BotIcon, Clock3Icon, ImageIcon, Loader2Icon, RefreshCwIcon, SearchIcon, WrenchIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useChatRuns } from '@/features/chat/hooks/use-chat-runs';
import type { ChatRunListItem, ChatRunStatus } from '@/features/chat/audit/types';

type ChatRunsCardProps = {
  limit?: number;
  className?: string;
  title?: string;
  description?: string;
};

const statusBadgeVariant: Record<ChatRunStatus, 'secondary' | 'destructive' | 'outline'> = {
  success: 'secondary',
  error: 'destructive',
  pending: 'outline',
};

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

function RouteIcon({ routeKind }: { routeKind: ChatRunListItem['routeKind'] }) {
  return routeKind === 'image'
    ? <ImageIcon className="size-3.5" />
    : <BotIcon className="size-3.5" />;
}

function RunRow({ run }: { run: ChatRunListItem }) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            <RouteIcon routeKind={run.routeKind} />
            <span className="capitalize">{run.routeKind} run</span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>Thread {run.threadId}</span>
            {run.routingMode ? <span className="capitalize">- {run.routingMode}</span> : null}
            {run.resolvedModelId ? <span>- {run.resolvedModelId}</span> : null}
          </div>
        </div>
        <Badge variant={statusBadgeVariant[run.status]} className="capitalize">
          {run.status}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{formatDate(run.createdAt)}</span>
        {run.usedTools ? (
          <span className="inline-flex items-center gap-1">
            <WrenchIcon className="size-3" />
            {run.toolCallCount} tool {run.toolCallCount === 1 ? 'call' : 'calls'}
          </span>
        ) : null}
        {typeof run.totalTokens === 'number' ? <span>{run.totalTokens} tokens</span> : null}
        {typeof run.creditCost === 'number' ? <span>{run.creditCost} credits</span> : null}
      </div>

      {run.routingReason ? (
        <div className="text-xs text-muted-foreground">
          Routing: {run.routingReason}
        </div>
      ) : null}

      {run.errorMessage ? (
        <div className="text-xs text-destructive">{run.errorMessage}</div>
      ) : null}
    </div>
  );
}

export function ChatRunsCard({
  limit = 10,
  className,
  title = 'Chat observability',
  description = 'Recent main chat runs, status counts, routing, and model usage for your account.',
}: ChatRunsCardProps) {
  const { data, isLoading, isFetching, error, refetch } = useChatRuns(limit);

  return (
    <Card className={cn('gap-4', className)}>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <SearchIcon className="size-4" />
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
            Loading chat activity...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-4 text-sm text-destructive">
            {error instanceof Error ? error.message : 'Failed to load chat activity.'}
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
              {data.summary.byRouteKind.map((item) => (
                <Badge key={`route-${item.key}`} variant="outline" className="gap-1.5 capitalize">
                  <Clock3Icon className="size-3" />
                  {item.key}: {item.count}
                </Badge>
              ))}
              {data.summary.byRoutingMode.map((item) => (
                <Badge key={`routing-${item.key}`} variant="outline" className="capitalize">
                  {item.key}: {item.count}
                </Badge>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {data.summary.byResolvedModel.map((item) => (
                <Badge key={`model-${item.key}`} variant="outline">
                  {item.key}: {item.count}
                </Badge>
              ))}
            </div>

            <Separator />

            {data.runs.length === 0 ? (
              <div className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
                No chat runs yet.
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
