'use client';

import { useQuery } from '@tanstack/react-query';
import type { TeamRunRow, TeamRunWithSteps } from '../types';

const teamRunsKey = (teamId: string) => ['team-runs', teamId] as const;
const teamRunKey = (runId: string) => ['team-run', runId] as const;

export function useTeamRuns(teamId: string | null) {
  return useQuery<{ runs: TeamRunRow[] }>({
    queryKey: teamRunsKey(teamId ?? ''),
    queryFn: async () => {
      const res = await fetch(`/api/team-runs?teamId=${teamId}`);
      if (!res.ok) throw new Error('Failed to load runs');
      return res.json() as Promise<{ runs: TeamRunRow[] }>;
    },
    enabled: Boolean(teamId),
    staleTime: 30 * 1000,
  });
}

export function useTeamRun(runId: string | null, teamId: string | null) {
  return useQuery<{ run: TeamRunWithSteps }>({
    queryKey: teamRunKey(runId ?? ''),
    queryFn: async () => {
      const res = await fetch(`/api/team-runs?teamId=${teamId}&runId=${runId}`);
      if (!res.ok) throw new Error('Failed to load run');
      return res.json() as Promise<{ run: TeamRunWithSteps }>;
    },
    enabled: Boolean(runId) && Boolean(teamId),
    staleTime: 5 * 60 * 1000,
  });
}
