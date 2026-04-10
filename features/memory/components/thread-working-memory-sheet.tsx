'use client';

import { RefreshCwIcon, Trash2Icon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useClearThreadWorkingMemory, useRefreshThreadWorkingMemory, useThreadWorkingMemory } from '@/features/memory/hooks/use-memory';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadId: string | null;
  threadTitle?: string;
};

const formatTimestamp = (value: Date | string | null | undefined) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const renderList = (items: string[]) => {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">None captured yet.</p>;
  }

  return (
    <ul className="space-y-2 text-sm text-foreground/90">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="rounded-lg bg-muted/30 px-3 py-2">
          {item}
        </li>
      ))}
    </ul>
  );
};

export function ThreadWorkingMemorySheet({ open, onOpenChange, threadId, threadTitle }: Props) {
  const { data, isLoading } = useThreadWorkingMemory(threadId);
  const refreshMutation = useRefreshThreadWorkingMemory(threadId);
  const clearMutation = useClearThreadWorkingMemory(threadId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader className="border-b border-black/5 px-6 py-4 dark:border-border">
          <SheetTitle>Thread working memory</SheetTitle>
          <SheetDescription>
            System-managed memory for the current thread. It keeps the running objective,
            decisions, and unresolved questions compact between turns.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-black/5 px-6 py-3 dark:border-border">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{threadTitle ?? 'Current thread'}</p>
              <p className="text-xs text-muted-foreground">
                {data?.refreshedAt ? `Last refreshed ${formatTimestamp(data.refreshedAt)}` : 'No working memory stored yet'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {data?.refreshStatus && (
                <Badge variant="secondary">{data.refreshStatus}</Badge>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!threadId || refreshMutation.isPending}
                onClick={() => refreshMutation.mutate()}
              >
                <RefreshCwIcon className="mr-1.5 size-3.5" />
                Refresh
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={!threadId || clearMutation.isPending}
                onClick={() => clearMutation.mutate()}
              >
                <Trash2Icon className="mr-1.5 size-3.5" />
                Clear
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {isLoading && (
              <p className="text-sm text-muted-foreground">Loading working memory…</p>
            )}

            {!isLoading && !data && (
              <div className="rounded-xl border border-dashed border-black/10 bg-muted/15 px-4 py-5 text-sm text-muted-foreground dark:border-border">
                No working memory has been persisted for this thread yet. Use Refresh to build it from the current conversation.
              </div>
            )}

            {data && (
              <div className="space-y-5">
                <section className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Summary
                  </p>
                  <p className="rounded-xl bg-muted/25 px-4 py-3 text-sm text-foreground/90">
                    {data.summary || 'No summary captured yet.'}
                  </p>
                </section>

                <section className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Current Objective
                  </p>
                  <p className="rounded-xl bg-muted/25 px-4 py-3 text-sm text-foreground/90">
                    {data.currentObjective || 'No active objective captured yet.'}
                  </p>
                </section>

                <section className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Decisions
                  </p>
                  {renderList(data.decisions)}
                </section>

                <section className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Open Questions
                  </p>
                  {renderList(data.openQuestions)}
                </section>

                <section className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Important Context
                  </p>
                  {renderList(data.importantContext)}
                </section>

                <section className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Recent Artifacts
                  </p>
                  {renderList(data.recentArtifacts)}
                </section>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
