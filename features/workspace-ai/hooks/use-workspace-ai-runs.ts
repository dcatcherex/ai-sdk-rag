'use client';

import { useQuery } from '@tanstack/react-query';
import { requestWorkspaceAiRunsOverview } from '../client';

export const workspaceAiKeys = {
  runs: (limit: number) => ['workspace-ai', 'runs', limit] as const,
};

export function useWorkspaceAiRuns(limit = 20) {
  return useQuery({
    queryKey: workspaceAiKeys.runs(limit),
    queryFn: () => requestWorkspaceAiRunsOverview(limit),
  });
}
