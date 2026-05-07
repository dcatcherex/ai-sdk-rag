'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  SparklesIcon,
  WrenchIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type {
  ImprovementPlan,
  ImprovementChange,
  StructuralChange,
} from '@/features/agents/types/optimizer';

type GenerateResponse = {
  auditRunId: string | null;
  plan: ImprovementPlan;
  scoreBefore: number;
  statusBefore: string;
};

type HistoryRun = {
  id: string;
  scoreBefore: number;
  scoreAfter: number | null;
  statusBefore: string;
  statusAfter: string | null;
  testMessage: string;
  plan: ImprovementPlan | null;
  appliedChangeIds: string[];
  createdAt: string;
};

type ApplyResponse = {
  auditRunId: string;
  appliedChangeIds: string[];
  skippedChangeIds: string[];
  scoreAfter: number;
  statusAfter: string;
  errors: Array<{ changeId: string; error: string }>;
};

type Props = {
  agentId: string;
  apiBase: '/api/admin/agents' | '/api/agents';
  initialTestMessage?: string;
};

function ScoreBar({
  scoreBefore,
  scoreEstimated,
}: {
  scoreBefore: number;
  scoreEstimated: number;
}) {
  const improved = scoreEstimated > scoreBefore;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-muted-foreground">Readiness</span>
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold tabular-nums">{scoreBefore}</span>
        <span className="text-muted-foreground">→</span>
        <span className={`text-2xl font-bold tabular-nums ${improved ? 'text-green-600' : 'text-muted-foreground'}`}>
          {scoreEstimated}
        </span>
      </div>
      <span className="text-xs text-muted-foreground">estimated after all fixes</span>
    </div>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  if (risk === 'high') return <Badge variant="destructive">High risk</Badge>;
  if (risk === 'medium') return <Badge variant="secondary">Review</Badge>;
  return <Badge variant="outline">Low risk</Badge>;
}

function PromptDiff({ before, after }: { before: string; after: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="whitespace-pre-wrap rounded border bg-red-50 p-2 font-mono leading-relaxed dark:bg-red-950/20">
        {before || '(empty)'}
      </div>
      <div className="whitespace-pre-wrap rounded border bg-green-50 p-2 font-mono leading-relaxed dark:bg-green-950/20">
        {after}
      </div>
    </div>
  );
}

function ChangeCard({
  change,
  applied,
  onApply,
  isApplying,
  errorMessage,
}: {
  change: ImprovementChange;
  applied: boolean;
  onApply: () => void;
  isApplying: boolean;
  errorMessage?: string;
}) {
  const [open, setOpen] = useState(false);

  const hasDiff =
    change.type === 'system_prompt' ||
    change.type === 'skill_fork' ||
    change.type === 'tool_optimize';

  return (
    <div className={`rounded-lg border p-3 ${applied ? 'border-green-200 bg-green-50/50 dark:border-green-900/40 dark:bg-green-950/20' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{change.title}</span>
            <RiskBadge risk={change.risk} />
            {applied && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle2Icon className="size-3" />
                Applied
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{change.rationale}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {hasDiff && !applied && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <ChevronUpIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" />}
              {open ? 'Hide diff' : 'Show diff'}
            </Button>
          )}
          {!applied && (
            <Button
              type="button"
              size="sm"
              onClick={onApply}
              disabled={isApplying}
            >
              Apply
            </Button>
          )}
        </div>
      </div>

      {open && hasDiff && (
        <div className="mt-3">
          {change.type === 'system_prompt' && (
            <PromptDiff before={change.before} after={change.after} />
          )}
          {change.type === 'skill_fork' && (
            <PromptDiff
              before={`Skill: ${change.originalSkillName}\n\n(original prompt fragment)`}
              after={change.improvedPromptFragment}
            />
          )}
          {change.type === 'tool_optimize' && (
            <PromptDiff before={change.descriptionBefore} after={change.descriptionAfter} />
          )}
        </div>
      )}

      {change.type === 'skill_new' && !applied && (
        <div className="mt-2 rounded bg-muted/50 p-2 text-xs">
          <span className="font-medium">New skill: </span>
          <code>{change.skillName}</code>
          {' — '}{change.skillDescription}
        </div>
      )}

      {errorMessage && !applied && (
        <div className="mt-2 rounded border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          {errorMessage}
        </div>
      )}
    </div>
  );
}

function LowRiskSection({
  changes,
  onApplyAll,
  isApplying,
  appliedIds,
}: {
  changes: StructuralChange[];
  onApplyAll: () => void;
  isApplying: boolean;
  appliedIds: Set<string>;
}) {
  const pending = changes.filter((change) => !appliedIds.has(change.id));
  if (changes.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <WrenchIcon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Structural fixes</span>
          <Badge variant="outline">{changes.length}</Badge>
        </div>
        {pending.length > 0 && (
          <Button
            type="button"
            size="sm"
            onClick={onApplyAll}
            disabled={isApplying}
          >
            Apply all ({pending.length})
          </Button>
        )}
      </div>
      <div className="space-y-1.5">
        {changes.map((change) => (
          <div
            key={change.id}
            className={`flex items-start gap-2 rounded border p-2.5 text-sm ${appliedIds.has(change.id) ? 'border-green-200 bg-green-50/50 dark:border-green-900/40 dark:bg-green-950/20' : 'bg-muted/30'}`}
          >
            {appliedIds.has(change.id) && <CheckCircle2Icon className="mt-0.5 size-3.5 shrink-0 text-green-600" />}
            <div className="min-w-0">
              <span className="font-medium">{change.title}</span>
              <p className="text-xs text-muted-foreground">{change.rationale}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditHistorySection({ runs }: { runs: HistoryRun[] | undefined }) {
  if (!runs || runs.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ClockIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">History</span>
      </div>
      <div className="space-y-1">
        {runs.map((run) => (
          <div key={run.id} className="flex items-center gap-3 rounded border px-3 py-2 text-xs">
            <span className="text-muted-foreground">{new Date(run.createdAt).toLocaleString()}</span>
            <span className="font-mono font-medium">{run.scoreBefore}</span>
            {run.scoreAfter !== null && (
              <>
                <span className="text-muted-foreground">→</span>
                <span className={`font-mono font-medium ${run.scoreAfter > run.scoreBefore ? 'text-green-600' : ''}`}>
                  {run.scoreAfter}
                </span>
              </>
            )}
            {run.appliedChangeIds.length > 0 && (
              <Badge variant="secondary">{run.appliedChangeIds.length} applied</Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AgentOptimizerPanel({ agentId, apiBase, initialTestMessage }: Props) {
  const queryClient = useQueryClient();
  const [testMessage, setTestMessage] = useState(initialTestMessage ?? '');
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [auditRunId, setAuditRunId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [applyErrors, setApplyErrors] = useState<Record<string, string>>({});

  const analyzeMutation = useMutation({
    mutationFn: async (): Promise<GenerateResponse> => {
      const res = await fetch(`${apiBase}/${agentId}/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testMessage }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
      setAuditRunId(data.auditRunId);
      setAppliedIds(new Set());
      setApplyErrors({});
    },
  });

  const applyMutation = useMutation({
    mutationFn: async (changeIds: string[]): Promise<ApplyResponse> => {
      const res = await fetch(`${apiBase}/${agentId}/optimize/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditRunId, changeIds }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      const ids = data.appliedChangeIds as string[];
      setAppliedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });
      setApplyErrors((prev) => {
        const next = { ...prev };
        ids.forEach((id) => {
          delete next[id];
        });
        for (const error of data.errors ?? []) {
          next[error.changeId] = error.error;
        }
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ['agent-audit-history', agentId] });
    },
  });

  const historyQuery = useQuery({
    queryKey: ['agent-audit-history', agentId],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/${agentId}/optimize/history`);
      if (!res.ok) throw new Error('Failed to load history');
      return res.json() as Promise<{ runs: HistoryRun[] }>;
    },
  });

  useEffect(() => {
    if (result || !historyQuery.data?.runs?.length) return;

    const latestRun = historyQuery.data.runs[0];
    if (!latestRun?.plan) return;

    setResult({
      auditRunId: latestRun.id,
      plan: latestRun.plan,
      scoreBefore: latestRun.scoreBefore,
      statusBefore: latestRun.statusBefore,
    });
    setAuditRunId(latestRun.id);
    setAppliedIds(new Set(latestRun.appliedChangeIds));
    if (latestRun.testMessage) {
      setTestMessage(latestRun.testMessage);
    }
  }, [historyQuery.data, result]);

  const plan = result?.plan ?? null;
  const structuralChanges = (plan?.changes ?? []).filter(
    (change): change is StructuralChange => change.type === 'structural',
  );
  const contentChanges = (plan?.changes ?? []).filter((change) => change.type !== 'structural');
  const allApplied =
    plan !== null &&
    plan.changes.length > 0 &&
    plan.changes.every((change) => appliedIds.has(change.id));

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Test message</label>
        <Textarea
          value={testMessage}
          onChange={(event) => setTestMessage(event.target.value)}
          placeholder="Enter a realistic user message to preview skill activation…"
          rows={2}
          className="resize-none text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Pre-filled from starter task. Edit to match your agent&apos;s primary use case.
        </p>
      </div>

      <Button
        type="button"
        onClick={() => analyzeMutation.mutate()}
        disabled={analyzeMutation.isPending}
        className="gap-2"
      >
        <SparklesIcon className="size-4" />
        {analyzeMutation.isPending ? 'Analyzing…' : 'Analyze Agent'}
      </Button>

      {analyzeMutation.error && (
        <p className="rounded border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
          {String(analyzeMutation.error)}
        </p>
      )}

      {plan && result && (
        <div className="space-y-4 rounded-lg border p-4">
          <ScoreBar scoreBefore={result.scoreBefore} scoreEstimated={plan.estimatedScoreAfter} />

          {plan.reasoning && (
            <p className="text-sm text-muted-foreground">{plan.reasoning}</p>
          )}

          {plan.changes.length === 0 && (
            <p className="flex items-center gap-2 text-sm font-medium text-green-600">
              <CheckCircle2Icon className="size-4" />
              Agent is already fully optimized.
            </p>
          )}

          <LowRiskSection
            changes={structuralChanges}
            onApplyAll={() => applyMutation.mutate(structuralChanges.filter((change) => !appliedIds.has(change.id)).map((change) => change.id))}
            isApplying={applyMutation.isPending}
            appliedIds={appliedIds}
          />

          {contentChanges.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <SparklesIcon className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">Content improvements</span>
                <Badge variant="outline">{contentChanges.length}</Badge>
              </div>
              <div className="space-y-2">
                {contentChanges.map((change) => (
                  <ChangeCard
                    key={change.id}
                    change={change}
                    applied={appliedIds.has(change.id)}
                    onApply={() => applyMutation.mutate([change.id])}
                    isApplying={applyMutation.isPending}
                    errorMessage={applyErrors[change.id]}
                  />
                ))}
              </div>
            </div>
          )}

          {allApplied && (
            <p className="flex items-center gap-2 text-sm font-medium text-green-600">
              <CheckCircle2Icon className="size-4" />
              All changes applied.
            </p>
          )}

          {applyMutation.error && (
            <p className="rounded border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
              {String(applyMutation.error)}
            </p>
          )}

          {!applyMutation.error && Object.keys(applyErrors).length > 0 && (
            <p className="rounded border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
              Some changes could not be applied. See the error message on each item.
            </p>
          )}
        </div>
      )}

      <AuditHistorySection runs={historyQuery.data?.runs} />
    </div>
  );
}
