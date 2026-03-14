'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateSkillInput, Skill, UpdateSkillInput } from '../types';

const KEY = ['skills'] as const;

export function useSkills() {
  return useQuery<Skill[]>({
    queryKey: KEY,
    queryFn: async () => {
      const res = await fetch('/api/skills');
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<Skill[]>;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateSkillInput) => {
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<Skill>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateSkillInput & { id: string }) => {
      const res = await fetch(`/api/skills/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<Skill>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (skillId: string) => {
      const res = await fetch(`/api/skills/${skillId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useImportSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (url: string) => {
      const res = await fetch('/api/skills/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<Skill>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useInstallSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (skillId: string) => {
      const res = await fetch(`/api/skills/${skillId}/install`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<Skill>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
