'use client';

import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { TeamRunStatusUpdate } from '../types';

export type TeamChatStatus = 'idle' | 'running' | 'done' | 'error';

export type UseTeamChatResult = {
  status: TeamChatStatus;
  /** Accumulated step progress updates from message-metadata chunks */
  teamUpdates: TeamRunStatusUpdate[];
  /** Final synthesised text from the orchestrator */
  output: string;
  error: string | null;
  /** Submit a prompt to the team */
  run: (userPrompt: string) => Promise<void>;
  /** Reset state back to idle */
  reset: () => void;
};

/**
 * Hook for running a supervised multi-agent team.
 *
 * Uses `readUIMessageStream` (Vercel AI SDK) to parse the binary stream
 * from POST /api/team-chat. Step progress arrives via 'message-metadata'
 * chunks; the final answer arrives via 'text-delta' chunks.
 */
export function useTeamChat(teamId: string, threadId?: string | null): UseTeamChatResult {
  const [status, setStatus] = useState<TeamChatStatus>('idle');
  const [teamUpdates, setTeamUpdates] = useState<TeamRunStatusUpdate[]>([]);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const qc = useQueryClient();

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStatus('idle');
    setTeamUpdates([]);
    setOutput('');
    setError(null);
  }, []);

  const run = useCallback(
    async (userPrompt: string) => {
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
          body: JSON.stringify({ teamId, userPrompt, threadId: threadId ?? null }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({ error: 'Request failed' }));
          throw new Error(
            (body as { error?: string }).error ?? `HTTP ${response.status}`,
          );
        }

        if (!response.body) throw new Error('No response body');

        // Import lazily to avoid server-side issues
        const { readUIMessageStream } = await import('ai');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for await (const message of readUIMessageStream({
          stream: response.body as unknown as Parameters<typeof readUIMessageStream>[0]['stream'],
          onError: (err) => { throw err; },
        })) {
          if (controller.signal.aborted) break;

          // Metadata carries accumulated teamUpdates
          const meta = message.metadata as { teamUpdates?: TeamRunStatusUpdate[] } | undefined;
          if (Array.isArray(meta?.teamUpdates)) {
            setTeamUpdates([...meta.teamUpdates]);
          }

          // Accumulate text from text parts
          const text = message.parts
            .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
            .map((p) => p.text)
            .join('');
          if (text) setOutput(text);
        }

        if (!controller.signal.aborted) {
          setStatus('done');
          // Refresh history tab
          void qc.invalidateQueries({ queryKey: ['team-runs', teamId] });
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        setStatus('error');
      }
    },
    [teamId, threadId],
  );

  return { status, teamUpdates, output, error, run, reset };
}
