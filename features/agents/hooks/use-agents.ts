import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Agent, CreateAgentInput, UpdateAgentInput } from '../types';

const AGENTS_QUERY_KEY = ['agents'] as const;

export const useAgents = () =>
  useQuery<Agent[]>({
    queryKey: AGENTS_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch('/api/agents');
      if (!res.ok) throw new Error('Failed to load agents');
      const data = (await res.json()) as { agents: Agent[] };
      return data.agents;
    },
    staleTime: 5 * 60 * 1000,
  });

export const useCreateAgent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAgentInput) => {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error('Failed to create agent');
      const data = (await res.json()) as { agent: Agent };
      return data.agent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
    },
  });
};

export const useUpdateAgent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateAgentInput & { id: string }) => {
      const res = await fetch(`/api/agents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error('Failed to update agent');
      const data = (await res.json()) as { agent: Agent };
      return data.agent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
    },
  });
};

export const useDeleteAgent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete agent');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
    },
  });
};
