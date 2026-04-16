'use client';

import { useState, useCallback, useRef } from 'react';
import { getPollingService } from '@/lib/polling/GenerationPollingService';

export type PollStatus = 'idle' | 'polling' | 'success' | 'failed' | 'timeout' | 'delayed';

export interface GenerationPollState {
  status: PollStatus;
  output?: string;
  outputs?: string[];
  error?: string;
  generationId?: string;
}

export interface StartPollOptions {
  taskId: string;
  generationId: string;
  modelId?: string;
  promptTitle?: string;
}

export interface UseGenerationPollReturn {
  state: GenerationPollState;
  startPoll: (opts: StartPollOptions) => Promise<void>;
  checkNow: () => Promise<void>;
  reset: () => void;
}

/**
 * React hook that wraps GenerationPollingService for use in tool page components.
 * Manages poll state (idle → polling → success/failed/timeout).
 */
export function useGenerationPoll(): UseGenerationPollReturn {
  const [state, setState] = useState<GenerationPollState>({ status: 'idle' });
  const abortRef = useRef(false);
  const lastStartRef = useRef<StartPollOptions | null>(null);

  const startPoll = useCallback(async ({ taskId, generationId, modelId = '', promptTitle = '' }: StartPollOptions) => {
    abortRef.current = false;
    lastStartRef.current = { taskId, generationId, modelId, promptTitle };
    setState({ status: 'polling', generationId });

    const service = getPollingService();
    const result = await service.poll(
      { taskId, generationId, modelId, promptId: generationId, promptTitle },
      { shouldAbort: () => abortRef.current },
    );

    if (result.status === 'aborted') {
      setState({ status: 'idle' });
      return;
    }

    if (result.status === 'success') {
      setState({ status: 'success', output: result.output, outputs: result.outputUrls, generationId });
    } else if (result.status === 'failed') {
      setState({ status: 'failed', error: result.error, generationId });
    } else {
      setState({
        status: 'delayed',
        error: 'The provider is taking longer than usual. We will keep this job open and you can check again shortly.',
        generationId,
      });
    }
  }, []);

  const checkNow = useCallback(async () => {
    if (!lastStartRef.current || state.status === 'polling') {
      return;
    }

    await startPoll(lastStartRef.current);
  }, [startPoll, state.status]);

  const reset = useCallback(() => {
    abortRef.current = true;
    setState({ status: 'idle' });
  }, []);

  return { state, startPoll, checkNow, reset };
}
