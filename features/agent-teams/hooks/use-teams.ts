'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AgentTeamRow,
  AgentTeamMemberRow,
  CreateAgentTeamInput,
  UpdateAgentTeamInput,
  AddTeamMemberInput,
  UpdateTeamMemberInput,
} from '../types';

export type TeamWithMembers = AgentTeamRow & {
  members: (AgentTeamMemberRow & {
    agentName: string;
    agentDescription: string | null;
    agentModelId: string | null;
  })[];
};

const TEAMS_KEY = ['agent-teams'] as const;
const teamKey = (id: string) => ['agent-teams', id] as const;

// ── List ──────────────────────────────────────────────────────────────────────

export function useTeams() {
  return useQuery<{ teams: TeamWithMembers[] }>({
    queryKey: TEAMS_KEY,
    queryFn: async () => {
      const res = await fetch('/api/agent-teams');
      if (!res.ok) throw new Error('Failed to load teams');
      return res.json() as Promise<{ teams: TeamWithMembers[] }>;
    },
    staleTime: 2 * 60 * 1000,
  });
}

// ── Single team (full members + agent details) ────────────────────────────────

export function useTeam(teamId: string | null) {
  return useQuery({
    queryKey: teamKey(teamId ?? ''),
    queryFn: async () => {
      const res = await fetch(`/api/agent-teams/${teamId}`);
      if (!res.ok) throw new Error('Failed to load team');
      return res.json() as Promise<{ team: TeamWithMembers }>;
    },
    enabled: Boolean(teamId),
    staleTime: 60 * 1000,
  });
}

// ── Create ────────────────────────────────────────────────────────────────────

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAgentTeamInput) => {
      const res = await fetch('/api/agent-teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error('Failed to create team');
      return (await res.json() as { team: AgentTeamRow }).team;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TEAMS_KEY }),
  });
}

// ── Update ────────────────────────────────────────────────────────────────────

export function useUpdateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateAgentTeamInput & { id: string }) => {
      const res = await fetch(`/api/agent-teams/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error('Failed to update team');
      return (await res.json() as { team: AgentTeamRow }).team;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: TEAMS_KEY });
      qc.invalidateQueries({ queryKey: teamKey(vars.id) });
    },
  });
}

// ── Delete ────────────────────────────────────────────────────────────────────

export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/agent-teams/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete team');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TEAMS_KEY }),
  });
}

// ── Add member ────────────────────────────────────────────────────────────────

export function useAddTeamMember(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddTeamMemberInput) => {
      const res = await fetch(`/api/agent-teams/${teamId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to add member' }));
        throw new Error((err as { error?: string }).error ?? 'Failed to add member');
      }
      return (await res.json() as { member: AgentTeamMemberRow }).member;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TEAMS_KEY });
      qc.invalidateQueries({ queryKey: teamKey(teamId) });
    },
  });
}

// ── Update member ─────────────────────────────────────────────────────────────

export function useUpdateTeamMember(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ memberId, ...input }: UpdateTeamMemberInput & { memberId: string }) => {
      const res = await fetch(`/api/agent-teams/${teamId}/members/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error('Failed to update member');
      return (await res.json() as { member: AgentTeamMemberRow }).member;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TEAMS_KEY });
      qc.invalidateQueries({ queryKey: teamKey(teamId) });
    },
  });
}

// ── Remove member ─────────────────────────────────────────────────────────────

export function useRemoveTeamMember(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch(`/api/agent-teams/${teamId}/members/${memberId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to remove member');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TEAMS_KEY });
      qc.invalidateQueries({ queryKey: teamKey(teamId) });
    },
  });
}
