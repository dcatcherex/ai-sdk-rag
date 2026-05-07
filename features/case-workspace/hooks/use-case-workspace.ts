'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  AssignCaseInput,
  CaseWorkspaceCaseContext,
  CaseWorkspaceContact,
  CaseWorkspaceDashboard,
  CaseWorkspaceProfile,
  CaseWorkspaceSummary,
  CaseWorkspaceTask,
  CaseWorkspaceTimelineItem,
  CreateCaseInput,
  CreateContactInput,
  CreateTaskInput,
  CreateTimelineNoteInput,
  CreateWorkspaceProfileInput,
  SearchCasesInput,
  UpdateCaseInput,
  UpdateTaskInput,
} from '@/features/case-workspace/types';

export const caseWorkspaceKeys = {
  profiles: ['case-workspace', 'profiles'] as const,
  contacts: (profileId?: string) => ['case-workspace', 'contacts', profileId ?? 'all'] as const,
  cases: (filters?: SearchCasesInput) => ['case-workspace', 'cases', filters ?? {}] as const,
  caseContext: (caseId?: string) => ['case-workspace', 'case-context', caseId ?? 'none'] as const,
  tasks: (caseId?: string) => ['case-workspace', 'tasks', caseId ?? 'none'] as const,
  timeline: (caseId?: string) => ['case-workspace', 'timeline', caseId ?? 'none'] as const,
  summary: (caseId?: string) => ['case-workspace', 'summary', caseId ?? 'none'] as const,
  dashboard: (profileId?: string) => ['case-workspace', 'dashboard', profileId ?? 'none'] as const,
};

async function readJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json() as Promise<T>;
}

export function useCaseWorkspaceProfiles() {
  return useQuery<{ profiles: CaseWorkspaceProfile[] }>({
    queryKey: caseWorkspaceKeys.profiles,
    queryFn: () => readJson('/api/case-workspace/profiles'),
  });
}

export function useCaseWorkspaceContacts(profileId?: string) {
  return useQuery<{ contacts: CaseWorkspaceContact[] }>({
    queryKey: caseWorkspaceKeys.contacts(profileId),
    enabled: Boolean(profileId),
    queryFn: () => readJson(`/api/case-workspace/contacts?profileId=${encodeURIComponent(profileId!)}`),
  });
}

export function useCaseSearch(filters: SearchCasesInput) {
  return useQuery<{ cases: Array<CaseWorkspaceCaseContext['case']> }>({
    queryKey: caseWorkspaceKeys.cases(filters),
    queryFn: () =>
      readJson('/api/case-workspace/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      }),
  });
}

export function useCaseContext(caseId?: string) {
  return useQuery<{ context: CaseWorkspaceCaseContext | null }>({
    queryKey: caseWorkspaceKeys.caseContext(caseId),
    enabled: Boolean(caseId),
    queryFn: () => readJson(`/api/case-workspace/cases/${caseId}`),
  });
}

export function useCaseTasks(caseId?: string) {
  return useQuery<{ tasks: CaseWorkspaceTask[] }>({
    queryKey: caseWorkspaceKeys.tasks(caseId),
    enabled: Boolean(caseId),
    queryFn: () => readJson(`/api/case-workspace/cases/${caseId}/tasks`),
  });
}

export function useCaseTimeline(caseId?: string) {
  return useQuery<{ timeline: CaseWorkspaceTimelineItem[] }>({
    queryKey: caseWorkspaceKeys.timeline(caseId),
    enabled: Boolean(caseId),
    queryFn: async () => {
      const context = await readJson<{ context: CaseWorkspaceCaseContext | null }>(
        `/api/case-workspace/cases/${caseId}`,
      );
      return { timeline: context.context?.timeline ?? [] };
    },
  });
}

export function useCaseSummary(caseId?: string) {
  return useQuery<{ summary: CaseWorkspaceSummary | null }>({
    queryKey: caseWorkspaceKeys.summary(caseId),
    enabled: false,
    queryFn: () => readJson(`/api/case-workspace/cases/${caseId}/summary`),
  });
}

export function useCaseWorkspaceDashboard(profileId?: string) {
  return useQuery<{ dashboard: CaseWorkspaceDashboard }>({
    queryKey: caseWorkspaceKeys.dashboard(profileId),
    enabled: Boolean(profileId),
    queryFn: () => readJson(`/api/case-workspace/profiles/${profileId}/dashboard`),
  });
}

export function useCreateCaseWorkspaceProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorkspaceProfileInput) =>
      readJson<{ profile: CaseWorkspaceProfile }>('/api/case-workspace/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: caseWorkspaceKeys.profiles });
    },
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateContactInput) =>
      readJson<{ contact: CaseWorkspaceContact }>('/api/case-workspace/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: (_, input) => {
      void queryClient.invalidateQueries({ queryKey: caseWorkspaceKeys.contacts(input.profileId) });
    },
  });
}

export function useCreateCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCaseInput) =>
      readJson<{ case: CaseWorkspaceCaseContext['case'] }>('/api/case-workspace/cases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: (_, input) => {
      void queryClient.invalidateQueries({ queryKey: ['case-workspace', 'cases'] });
      void queryClient.invalidateQueries({ queryKey: caseWorkspaceKeys.dashboard(input.profileId) });
    },
  });
}

export function useUpdateCase(caseId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateCaseInput) =>
      readJson<{ case: CaseWorkspaceCaseContext['case'] }>(`/api/case-workspace/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: caseWorkspaceKeys.caseContext(caseId) });
      void queryClient.invalidateQueries({ queryKey: ['case-workspace', 'cases'] });
      void queryClient.invalidateQueries({ queryKey: ['case-workspace', 'dashboard'] });
    },
  });
}

export function useAssignCase(caseId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AssignCaseInput) =>
      readJson<{ case: CaseWorkspaceCaseContext['case'] }>(`/api/case-workspace/cases/${caseId}/assignment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: caseWorkspaceKeys.caseContext(caseId) });
      void queryClient.invalidateQueries({ queryKey: ['case-workspace', 'cases'] });
      void queryClient.invalidateQueries({ queryKey: ['case-workspace', 'dashboard'] });
    },
  });
}

export function useCreateTask(caseId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) =>
      readJson<{ task: CaseWorkspaceTask }>(`/api/case-workspace/cases/${caseId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: caseWorkspaceKeys.caseContext(caseId) });
      void queryClient.invalidateQueries({ queryKey: caseWorkspaceKeys.tasks(caseId) });
      void queryClient.invalidateQueries({ queryKey: ['case-workspace', 'dashboard'] });
    },
  });
}

export function useUpdateTask(caseId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { taskId: string; patch: UpdateTaskInput }) =>
      readJson<{ task: CaseWorkspaceTask }>(`/api/case-workspace/cases/${caseId}/tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: caseWorkspaceKeys.caseContext(caseId) });
      void queryClient.invalidateQueries({ queryKey: caseWorkspaceKeys.tasks(caseId) });
      void queryClient.invalidateQueries({ queryKey: ['case-workspace', 'dashboard'] });
    },
  });
}

export function useAddCaseNote(caseId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTimelineNoteInput) =>
      readJson<{ note: CaseWorkspaceTimelineItem }>(`/api/case-workspace/cases/${caseId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: caseWorkspaceKeys.caseContext(caseId) });
      void queryClient.invalidateQueries({ queryKey: caseWorkspaceKeys.timeline(caseId) });
    },
  });
}

export function useSummarizeCase(caseId?: string) {
  return useMutation({
    mutationFn: () =>
      readJson<{ summary: CaseWorkspaceSummary | null }>(`/api/case-workspace/cases/${caseId}/summary`),
  });
}
