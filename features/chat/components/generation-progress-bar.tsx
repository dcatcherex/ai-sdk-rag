'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, ImageIcon, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useGenerationProgress, type GenerationTask } from '@/features/chat/context/generation-progress-context';

function formatElapsed(startedAt?: string) {
  if (!startedAt) return '';
  const ms = Date.now() - Date.parse(startedAt);
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

function TaskRow({ task }: { task: GenerationTask }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (task.status !== 'polling') return;
    const id = window.setInterval(() => setTick(t => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [task.status]);

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 text-sm border-b border-black/5 dark:border-border last:border-0">
      {task.status === 'polling' ? (
        <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
      ) : task.status === 'success' ? (
        <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
      ) : (
        <XCircle className="size-3.5 text-destructive shrink-0" />
      )}
      <ImageIcon className="size-3.5 text-muted-foreground shrink-0" />
      <span className="flex-1 text-muted-foreground text-xs font-mono truncate">
        {task.generationId.slice(0, 8)}…
      </span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {task.status === 'polling'
          ? formatElapsed(task.startedAt)
          : task.status === 'success'
          ? 'done'
          : 'error'}
      </span>
    </div>
  );
}

export function GenerationProgressBar() {
  const ctx = useGenerationProgress();
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(false);

  const taskList = ctx ? Object.values(ctx.tasks) : [];
  const activeCount = taskList.filter(t => t.status === 'polling').length;
  const doneCount = taskList.filter(t => t.status === 'success').length;
  const errorCount = taskList.filter(
    t => t.status === 'failed' || t.status === 'timeout' || t.status === 'delayed',
  ).length;
  const totalCount = taskList.length;

  // Show bar when tasks appear
  useEffect(() => {
    if (totalCount > 0) setVisible(true);
  }, [totalCount]);

  // Auto-hide 3s after all complete with no errors
  useEffect(() => {
    if (totalCount > 0 && activeCount === 0 && errorCount === 0) {
      const timer = window.setTimeout(() => setVisible(false), 3000);
      return () => window.clearTimeout(timer);
    }
  }, [activeCount, errorCount, totalCount]);

  if (!visible || totalCount === 0) return null;

  const allDone = activeCount === 0;
  const hasErrors = errorCount > 0;

  return (
    <div className="border-t border-black/5 dark:border-border">
      {/* Expanded drawer */}
      {expanded && (
        <div className="bg-background/95 backdrop-blur max-h-52 overflow-y-auto">
          {taskList.map(task => (
            <TaskRow key={task.generationId} task={task} />
          ))}
        </div>
      )}

      {/* Mini-bar (40px) */}
      <div className="flex h-10 items-center gap-2.5 px-4 bg-background/80 backdrop-blur">
        {allDone && !hasErrors ? (
          <CheckCircle2 className="size-4 text-green-500 shrink-0" />
        ) : hasErrors && !activeCount ? (
          <XCircle className="size-4 text-destructive shrink-0" />
        ) : (
          <Loader2 className="size-4 animate-spin text-primary shrink-0" />
        )}

        <span className="flex-1 text-sm text-muted-foreground">
          {allDone && !hasErrors
            ? `${doneCount} image${doneCount !== 1 ? 's' : ''} ready`
            : hasErrors && !activeCount
            ? `${doneCount} done · ${errorCount} failed`
            : activeCount === 1 && totalCount === 1
            ? 'Generating image…'
            : `Generating ${totalCount} images · ${doneCount} done${errorCount ? ` · ${errorCount} error` : ''}`}
        </span>

        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-label={expanded ? 'Hide task list' : 'Show task list'}
        >
          {expanded ? (
            <>
              <ChevronDown className="size-3.5" />
              Hide
            </>
          ) : (
            <>
              <ChevronUp className="size-3.5" />
              Show
            </>
          )}
        </button>
      </div>
    </div>
  );
}
