import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Agent, CreateAgentInput, UpdateAgentInput } from '../types';
import type { AgentSkillAttachment } from '@/features/skills/types';

const AGENTS_QUERY_KEY = ['agents'] as const;
const agentSkillAttachmentsKey = (agentId: string) => ['agent-skill-attachments', agentId] as const;

type AgentsResponse = { agents: Agent[]; templates: Agent[] };
type AgentSkillAttachmentsResponse = { attachments: AgentSkillAttachment[] };

async function saveAgentSkillAttachments(agentId: string, skillAttachments: CreateAgentInput['skillAttachments']) {
  if (!skillAttachments) return;

  const res = await fetch(`/api/agents/${agentId}/skills`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attachments: skillAttachments }),
  });

  if (!res.ok) {
    throw new Error('Failed to save agent skill attachments');
  }
}

export const useAgents = () =>
  useQuery<AgentsResponse>({
    queryKey: AGENTS_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch('/api/agents');
      if (!res.ok) throw new Error('Failed to load agents');
      return res.json() as Promise<AgentsResponse>;
    },
    staleTime: 5 * 60 * 1000,
  });

export const useAgentSkillAttachments = (agentId: string | null) =>
  useQuery<AgentSkillAttachment[]>({
    queryKey: agentId ? agentSkillAttachmentsKey(agentId) : ['agent-skill-attachments', 'new'],
    queryFn: async () => {
      const res = await fetch(`/api/agents/${agentId}/skills`);
      if (!res.ok) throw new Error('Failed to load agent skill attachments');
      const data = await res.json() as AgentSkillAttachmentsResponse;
      return data.attachments;
    },
    enabled: Boolean(agentId),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useCreateAgent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAgentInput) => {
      const { skillAttachments, ...agentInput } = input;
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentInput),
      });
      if (!res.ok) throw new Error('Failed to create agent');
      const data = (await res.json()) as { agent: Agent };
      await saveAgentSkillAttachments(data.agent.id, skillAttachments);
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
      const { skillAttachments, ...agentInput } = input;
      const res = await fetch(`/api/agents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentInput),
      });
      if (!res.ok) throw new Error('Failed to update agent');
      const data = (await res.json()) as { agent: Agent };
      await saveAgentSkillAttachments(id, skillAttachments);
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

export const useUseTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(`/api/agents/templates/${templateId}/use`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to use template');
      const data = (await res.json()) as { agent: Agent };
      return data.agent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
    },
  });
};
