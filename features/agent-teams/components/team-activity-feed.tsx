'use client';

import { CheckCircle2Icon, CircleDotIcon, AlertCircleIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgentStepCard } from './agent-step-card';
import type { TeamRunStatusUpdate, ArtifactType } from '../types';

type TeamActivityFeedProps = {
  updates: TeamRunStatusUpdate[];
  status: 'idle' | 'running' | 'done' | 'error';
};

/** Maps a step_start update to its matching step_complete (if any) */
function findComplete(
  updates: TeamRunStatusUpdate[],
  stepIndex: number,
): Extract<TeamRunStatusUpdate, { type: 'step_complete' }> | undefined {
  return updates.find(
    (u): u is Extract<TeamRunStatusUpdate, { type: 'step_complete' }> =>
      u.type === 'step_complete' && u.stepIndex === stepIndex,
  );
}

export function TeamActivityFeed({ updates, status }: TeamActivityFeedProps) {
  // Collect unique step_start entries (preserve order)
  const stepStarts = updates.filter(
    (u): u is Extract<TeamRunStatusUpdate, { type: 'step_start' }> =>
      u.type === 'step_start',
  );

  const runError = updates.find(
    (u): u is Extract<TeamRunStatusUpdate, { type: 'run_error' }> =>
      u.type === 'run_error',
  );

  if (stepStarts.length === 0 && status === 'idle') return null;

  return (
    <div className="space-y-2">
      {stepStarts.map((start, i) => {
        const complete = findComplete(updates, start.stepIndex);
        const isRunning = !complete && status === 'running';

        if (complete) {
          return (
            <AgentStepCard
              key={`${start.runId}-${start.stepIndex}`}
              step={complete}
              stepNumber={i + 1}
            />
          );
        }

        return (
          <div
            key={`${start.runId}-${start.stepIndex}`}
            className={cn(
              'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm',
              isRunning && 'bg-muted/30 animate-pulse',
            )}
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
              {i + 1}
            </span>
            <span className="flex-1 font-medium text-muted-foreground truncate">
              {start.displayRole ?? start.agentName}
            </span>
            {isRunning && (
              <CircleDotIcon className="size-3.5 text-primary shrink-0 animate-spin" />
            )}
          </div>
        );
      })}

      {/* Run-level status indicator */}
      {status === 'done' && stepStarts.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-green-600 dark:text-green-400">
          <CheckCircle2Icon className="size-3.5 shrink-0" />
          All steps complete — synthesizing final output…
        </div>
      )}

      {runError && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircleIcon className="size-3.5 shrink-0 mt-0.5" />
          {runError.error}
        </div>
      )}
    </div>
  );
}
