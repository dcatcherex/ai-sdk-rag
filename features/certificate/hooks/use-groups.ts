'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RecipientGroup, GroupPerson } from '../types';

const QUERY_KEY = ['recipient-groups'];

export function useGroups() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch('/api/certificate/groups');
      if (!res.ok) throw new Error('Failed to load groups');
      const data = await res.json() as { groups: RecipientGroup[] };
      return data.groups;
    },
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description?: string; recipients?: GroupPerson[] }) => {
      const res = await fetch('/api/certificate/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Failed to create group');
      return ((await res.json()) as { group: RecipientGroup }).group;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { id: string; name?: string; description?: string; recipients?: GroupPerson[] }) => {
      const { id, ...rest } = data;
      const res = await fetch(`/api/certificate/groups/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rest),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Failed to update group');
      return ((await res.json()) as { group: RecipientGroup }).group;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/certificate/groups/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete group');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
