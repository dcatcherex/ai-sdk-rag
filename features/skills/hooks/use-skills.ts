'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateSkillInput, Skill, SkillDetail, SkillSyncApplyResult, SkillSyncCheckResult, UpdateSkillInput } from '../types';

const KEY = ['skills'] as const;
const skillDetailKey = (skillId: string | null) => [...KEY, skillId] as const;
const skillFilesKey = (skillId: string | null) => [...KEY, skillId, 'files'] as const;
const skillFileContentKey = (skillId: string | null, relativePath: string | null) => [...KEY, skillId, 'files', 'content', relativePath] as const;

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

export function useSkillDetail(skillId: string | null) {
  return useQuery<SkillDetail>({
    queryKey: skillDetailKey(skillId),
    queryFn: async () => {
      const res = await fetch(`/api/skills/${skillId}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<SkillDetail>;
    },
    enabled: Boolean(skillId),
  });
}

export function useSkillFiles(skillId: string | null) {
  return useQuery<SkillDetail['files']>({
    queryKey: skillFilesKey(skillId),
    queryFn: async () => {
      const res = await fetch(`/api/skills/${skillId}/files`);
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<SkillDetail['files']>;
    },
    enabled: Boolean(skillId),
  });
}

export function useSkillFileContent(skillId: string | null, relativePath: string | null) {
  return useQuery<SkillDetail['files'][number]>({
    queryKey: skillFileContentKey(skillId, relativePath),
    queryFn: async () => {
      const params = new URLSearchParams({ path: relativePath ?? '' });
      const res = await fetch(`/api/skills/${skillId}/files/content?${params.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<SkillDetail['files'][number]>;
    },
    enabled: Boolean(skillId && relativePath),
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

export function useCreateSkillFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ skillId, path, textContent }: { skillId: string; path: string; textContent: string }) => {
      const res = await fetch(`/api/skills/${skillId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, textContent }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<SkillDetail['files'][number]>;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: skillFilesKey(variables.skillId) });
      qc.invalidateQueries({ queryKey: skillDetailKey(variables.skillId) });
    },
  });
}

export function useUpdateSkillFileContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ skillId, path, textContent }: { skillId: string; path: string; textContent: string }) => {
      const res = await fetch(`/api/skills/${skillId}/files/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, textContent }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<SkillDetail['files'][number]>;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: skillFilesKey(variables.skillId) });
      qc.invalidateQueries({ queryKey: skillDetailKey(variables.skillId) });
      qc.invalidateQueries({ queryKey: skillFileContentKey(variables.skillId, variables.path) });
    },
  });
}

export function useDeleteSkillFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ skillId, path }: { skillId: string; path: string }) => {
      const params = new URLSearchParams({ path });
      const res = await fetch(`/api/skills/${skillId}/files?${params.toString()}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: skillFilesKey(variables.skillId) });
      qc.invalidateQueries({ queryKey: skillDetailKey(variables.skillId) });
      qc.removeQueries({ queryKey: skillFileContentKey(variables.skillId, variables.path) });
    },
  });
}

export function useCheckSkillSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (skillId: string) => {
      const res = await fetch(`/api/skills/${skillId}/sync/check`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<SkillSyncCheckResult>;
    },
    onSuccess: (_data, skillId) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: skillDetailKey(skillId) });
    },
  });
}

export function useApplySkillSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (skillId: string) => {
      const res = await fetch(`/api/skills/${skillId}/sync/apply`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<SkillSyncApplyResult>;
    },
    onSuccess: (_data, skillId) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: skillDetailKey(skillId) });
      qc.invalidateQueries({ queryKey: skillFilesKey(skillId) });
    },
  });
}
