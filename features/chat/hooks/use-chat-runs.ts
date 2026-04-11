'use client';

import { useQuery } from '@tanstack/react-query';
import { requestChatRun, requestChatRunsOverview } from '@/features/chat/client';

export const chatRunKeys = {
  runs: (limit: number) => ['chat-runs', limit] as const,
  detail: (runId: string) => ['chat-runs', 'detail', runId] as const,
};

export function useChatRuns(limit = 20) {
  return useQuery({
    queryKey: chatRunKeys.runs(limit),
    queryFn: () => requestChatRunsOverview(limit),
  });
}

export function useChatRun(runId: string | null) {
  return useQuery({
    queryKey: runId ? chatRunKeys.detail(runId) : ['chat-runs', 'detail', 'empty'],
    queryFn: () => requestChatRun(runId!),
    enabled: !!runId,
  });
}
