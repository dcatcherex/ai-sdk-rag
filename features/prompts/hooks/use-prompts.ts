import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Prompt, CreatePromptInput, UpdatePromptInput } from '../types';

const PROMPTS_QUERY_KEY = ['prompts'] as const;

export const usePrompts = () =>
  useQuery<Prompt[]>({
    queryKey: PROMPTS_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch('/api/prompts');
      if (!res.ok) throw new Error('Failed to load prompts');
      const data = (await res.json()) as { prompts: Prompt[] };
      return data.prompts;
    },
    staleTime: 5 * 60 * 1000,
  });

export const useCreatePrompt = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePromptInput) => {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error('Failed to create prompt');
      const data = (await res.json()) as { prompt: Prompt };
      return data.prompt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROMPTS_QUERY_KEY });
    },
  });
};

export const useUpdatePrompt = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdatePromptInput & { id: string }) => {
      const res = await fetch(`/api/prompts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error('Failed to update prompt');
      const data = (await res.json()) as { prompt: Prompt };
      return data.prompt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROMPTS_QUERY_KEY });
    },
  });
};

export const useDeletePrompt = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/prompts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete prompt');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROMPTS_QUERY_KEY });
    },
  });
};

export const useIncrementPromptUsage = () =>
  useMutation({
    mutationFn: async (id: string) => {
      if (id.startsWith('builtin_')) return;
      await fetch(`/api/prompts/${id}/use`, { method: 'POST' });
    },
  });
