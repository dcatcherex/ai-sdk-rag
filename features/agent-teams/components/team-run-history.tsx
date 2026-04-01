'use client';

import { useState } from 'react';
import {
  CheckCircle2Icon,
  XCircleIcon,
  LoaderIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ClockIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgentStepCard } from './agent-step-card';
import { useTeamRuns, useTeamRun } from '../hooks/use-team-runs';
import type { TeamRunRow, ArtifactType } from '../types';

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string | Date) {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(start: string | Date, end: string | Date | null) {
  if (!end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

const STATUS_ICON = {
  completed: <CheckCircle2Icon className="size-3.5 text-green-500 shrink-0" />,
  failed: <XCircleIcon className="size-3.5 text-destructive shrink-0" />,
  running: <LoaderIcon className="size-3.5 text-primary shrink-0 animate-spin" />,
};

// ── RunRow — one entry in the list ────────────────────────────────────────────

function RunRow({ run, teamId }: { run: TeamRunRow; teamId: string }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useTeamRun(open ? run.id : null, teamId);

  const duration = formatDuration(run.createdAt, run.completedAt ?? null);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        type="button"
        className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {STATUS_ICON[run.status as keyof typeof STATUS_ICON] ?? STATUS_ICON.running}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium line-clamp-1">{run.inputPrompt}</p>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatDate(run.createdAt)}</span>
            {duration && (
              <>
                <span>·</span>
                <span className="flex items-center gap-0.5">
                  <ClockIcon className="size-3" />
                  {duration}
                </span>
              </>
            )}
            {run.spentCredits > 0 && (
              <>
                <span>·</span>
                <span>{run.spentCredits} cr</span>
              </>
            )}
          </div>
        </div>

        <span className="mt-0.5 shrink-0 text-muted-foreground">
          {open ? <ChevronDownIcon className="size-3.5" /> : <ChevronRightIcon className="size-3.5" />}
        </span>
      </button>

      {open && (
        <div className="border-t bg-muted/20 px-3 py-3 space-y-3">
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Loading steps…</p>
          ) : data ? (
            <>
              {/* Steps */}
              {data.run.steps.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Steps
                  </p>
                  {data.run.steps.map((step, i) => (
                    <AgentStepCard
                      key={step.id}
                      stepNumber={i + 1}
                      step={{
                        type: 'step_complete',
                        runId: step.runId,
                        stepIndex: step.stepIndex,
                        memberId: step.memberId ?? '',
                        agentId: step.agentId,
                        agentName: step.agentName,
                        displayRole: null,
                        summary: step.summary ?? step.output ?? '',
                        artifactType: (step.artifactType as ArtifactType) ?? 'other',
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Final output */}
              {data.run.finalOutput && (
                <div>
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Final output
                  </p>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed line-clamp-6">
                    {data.run.finalOutput}
                  </p>
                </div>
              )}

              {/* Error */}
              {data.run.errorMessage && (
                <p className="text-xs text-destructive">{data.run.errorMessage}</p>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── TeamRunHistory ─────────────────────────────────────────────────────────────

type TeamRunHistoryProps = {
  teamId: string;
};

export function TeamRunHistory({ teamId }: TeamRunHistoryProps) {
  const { data, isLoading } = useTeamRuns(teamId);
  const runs = data?.runs ?? [];

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading history…</p>;
  }

  if (runs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm font-medium">No runs yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Switch to the Run tab to start your first team run.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {runs.map((run) => (
        <RunRow key={run.id} run={run} teamId={teamId} />
      ))}
    </div>
  );
}
