import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CustomPersona } from '../types/custom-persona';

const QK = ['custom-personas'] as const;

export const useCustomPersonas = () =>
  useQuery<CustomPersona[]>({
    queryKey: QK,
    queryFn: async () => {
      const res = await fetch('/api/user/custom-personas');
      if (!res.ok) throw new Error('Failed to load personas');
      return res.json() as Promise<CustomPersona[]>;
    },
    staleTime: 5 * 60 * 1000,
  });

export const useCreateCustomPersona = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; systemPrompt: string }) => {
      const res = await fetch('/api/user/custom-personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error('Failed to create persona');
      return res.json() as Promise<CustomPersona>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
};

export const useUpdateCustomPersona = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; name?: string; systemPrompt?: string }) => {
      const res = await fetch(`/api/user/custom-personas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error('Failed to update persona');
      return res.json() as Promise<CustomPersona>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
};

export const useDeleteCustomPersona = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/user/custom-personas/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete persona');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
};
