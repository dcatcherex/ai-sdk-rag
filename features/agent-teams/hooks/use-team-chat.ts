'use client';

import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type {
  TeamRunStatusUpdate,
  OrchestratorPlan,
  PlanPreviewStep,
  RoutingStrategy,
} from '../types';

export type TeamChatStatus = 'idle' | 'running' | 'awaiting_approval' | 'done' | 'error';

export type UseTeamChatResult = {
  status: TeamChatStatus;
  /** Accumulated step progress updates from message-metadata chunks */
  teamUpdates: TeamRunStatusUpdate[];
  /** Final synthesised text from the orchestrator */
  output: string;
  error: string | null;
  /** Plan steps returned by the /plan endpoint (non-empty during awaiting_approval) */
  planSteps: PlanPreviewStep[];
  /** Synthesis instruction from the planner */
  synthesisInstruction: string;
  /** True when planner fell back to sequential due to JSON parse failure */
  planFallback: boolean;
  /** User-edited sub-prompts keyed by memberId */
  editedSubPrompts: Record<string, string>;
  /** Update the sub-prompt for a plan step */
  setEditedSubPrompt: (memberId: string, value: string) => void;
  /** For planner teams: fetch the plan first, entering awaiting_approval */
  fetchPlan: (userPrompt: string) => Promise<void>;
  /** Approve the current plan and execute the run */
  approvePlan: () => Promise<void>;
  /** Submit a prompt directly (sequential teams, or with an optional pre-approved plan) */
  run: (userPrompt: string, approvedPlan?: OrchestratorPlan) => Promise<void>;
  /** Reset state back to idle */
  reset: () => void;
};

/**
 * Hook for running a supervised multi-agent team.
 *
 * For planner_generated teams, call fetchPlan() first to enter the
 * awaiting_approval state, then approvePlan() to execute with the
 * reviewed/edited plan. For sequential teams, call run() directly.
 */
export function useTeamChat(
  teamId: string,
  routingStrategy: RoutingStrategy,
  threadId?: string | null,
): UseTeamChatResult {
  const [status, setStatus] = useState<TeamChatStatus>('idle');
  const [teamUpdates, setTeamUpdates] = useState<TeamRunStatusUpdate[]>([]);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [planSteps, setPlanSteps] = useState<PlanPreviewStep[]>([]);
  const [synthesisInstruction, setSynthesisInstruction] = useState('');
  const [planFallback, setPlanFallback] = useState(false);
  const [editedSubPrompts, setEditedSubPrompts] = useState<Record<string, string>>({});
  const pendingPromptRef = useRef<string>('');
  const abortRef = useRef<AbortController | null>(null);
  const qc = useQueryClient();

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStatus('idle');
    setTeamUpdates([]);
    setOutput('');
    setError(null);
    setPlanSteps([]);
    setSynthesisInstruction('');
    setPlanFallback(false);
    setEditedSubPrompts({});
    pendingPromptRef.current = '';
  }, []);

  const setEditedSubPrompt = useCallback((memberId: string, value: string) => {
    setEditedSubPrompts((prev) => ({ ...prev, [memberId]: value }));
  }, []);

  const run = useCallback(
    async (userPrompt: string, approvedPlan?: OrchestratorPlan) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus('running');
      setTeamUpdates([]);
      setOutput('');
      setError(null);

      try {
        const response = await fetch('/api/team-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamId,
            userPrompt,
            threadId: threadId ?? null,
            approvedPlan: approvedPlan ?? undefined,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({ error: 'Request failed' }));
          throw new Error(
            (body as { error?: string }).error ?? `HTTP ${response.status}`,
          );
        }

        if (!response.body) throw new Error('No response body');

        const { readUIMessageStream } = await import('ai');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for await (const message of readUIMessageStream({
          stream: response.body as unknown as Parameters<typeof readUIMessageStream>[0]['stream'],
          onError: (err) => { throw err; },
        })) {
          if (controller.signal.aborted) break;

          const meta = message.metadata as { teamUpdates?: TeamRunStatusUpdate[] } | undefined;
          if (Array.isArray(meta?.teamUpdates)) {
            setTeamUpdates([...meta.teamUpdates]);
          }

          const text = message.parts
            .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
            .map((p) => p.text)
            .join('');
          if (text) setOutput(text);
        }

        if (!controller.signal.aborted) {
          setStatus('done');
          void qc.invalidateQueries({ queryKey: ['team-runs', teamId] });
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        setStatus('error');
      }
    },
    [teamId, threadId, qc],
  );

  const fetchPlan = useCallback(
    async (userPrompt: string) => {
      if (routingStrategy !== 'planner_generated') {
        await run(userPrompt);
        return;
      }

      pendingPromptRef.current = userPrompt;
      setStatus('running');
      setError(null);

      try {
        const response = await fetch('/api/team-chat/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamId, userPrompt }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({ error: 'Failed to generate plan' }));
          throw new Error((body as { error?: string }).error ?? `HTTP ${response.status}`);
        }

        const data = await response.json() as {
          steps: PlanPreviewStep[];
          synthesisInstruction: string;
          fallback: boolean;
        };

        // Initialise edits to the planner's sub-prompts so user can modify them
        const initialEdits: Record<string, string> = {};
        for (const step of data.steps) {
          initialEdits[step.memberId] = step.subPrompt;
        }

        setPlanSteps(data.steps);
        setSynthesisInstruction(data.synthesisInstruction);
        setPlanFallback(data.fallback);
        setEditedSubPrompts(initialEdits);
        setStatus('awaiting_approval');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        setStatus('error');
      }
    },
    [teamId, routingStrategy, run],
  );

  const approvePlan = useCallback(async () => {
    const userPrompt = pendingPromptRef.current;
    if (!userPrompt || planSteps.length === 0) return;

    // Build OrchestratorPlan from reviewed steps (apply any user edits)
    const approvedPlan: OrchestratorPlan = {
      steps: planSteps.map((step) => ({
        memberId: step.memberId,
        subPrompt: editedSubPrompts[step.memberId] ?? step.subPrompt,
        artifactType: step.artifactType,
        usesPreviousSteps: [],
        reasoning: step.reasoning,
      })),
      synthesisInstruction,
    };

    await run(userPrompt, approvedPlan);
  }, [planSteps, editedSubPrompts, synthesisInstruction, run]);

  return {
    status,
    teamUpdates,
    output,
    error,
    planSteps,
    synthesisInstruction,
    planFallback,
    editedSubPrompts,
    setEditedSubPrompt,
    fetchPlan,
    approvePlan,
    run,
    reset,
  };
}
