'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const KEY = ['user-tools'] as const;
const detailKey = (toolId: string | null) => [...KEY, toolId] as const;
const runsKey = (toolId: string | null) => [...KEY, toolId, 'runs'] as const;
const sharesKey = (toolId: string | null) => [...KEY, toolId, 'shares'] as const;
const workspaceSharesKey = (toolId: string | null) => [...KEY, toolId, 'workspace-shares'] as const;
const shareableWorkspacesKey = [...KEY, 'shareable-workspaces'] as const;

export type UserToolListItem = {
  id: string;
  userId: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  category: string;
  executionType: string;
  visibility: string;
  status: string;
  readOnly: boolean;
  requiresConfirmation: boolean;
  supportsAgent: boolean;
  supportsManualRun: boolean;
  latestVersion: number;
  activeVersion: number | null;
  createdAt: string;
  updatedAt: string;
};

export type UserToolField = {
  key: string;
  label: string;
  type: 'text' | 'long_text' | 'number' | 'boolean' | 'enum' | 'date' | 'json';
  required?: boolean;
  helpText?: string;
  placeholder?: string;
  options?: string[];
  defaultValue?: unknown;
};

export type UserToolDetail = {
  tool: UserToolListItem;
  shareRole: string | null;
  isOwner: boolean;
  sharedWith: Array<{
    id: string;
    name: string;
    email: string;
    image?: string | null;
    role: 'runner' | 'editor';
  }>;
  workspaceShares: Array<{
    brandId: string;
    brandName: string;
    role: 'runner' | 'editor';
  }>;
  activeVersion: {
    id: string;
    toolId: string;
    version: number;
    inputSchemaJson: UserToolField[];
    outputSchemaJson: UserToolField[];
    configJson: Record<string, unknown>;
    changeSummary: string | null;
    isDraft: boolean;
    createdByUserId: string;
    createdAt: string;
  } | null;
  versions: Array<{
    id: string;
    toolId: string;
    version: number;
    inputSchemaJson: UserToolField[];
    outputSchemaJson: UserToolField[];
    configJson: Record<string, unknown>;
    changeSummary: string | null;
    isDraft: boolean;
    createdByUserId: string;
    createdAt: string;
  }>;
};

export type UserToolRun = {
  id: string;
  toolSlug: string;
  userId: string;
  threadId: string | null;
  source: string;
  inputJson: Record<string, unknown>;
  outputJson: Record<string, unknown> | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type UserToolSharedUser = UserToolDetail['sharedWith'][number];
export type UserToolSharedWorkspace = UserToolDetail['workspaceShares'][number];
export type UserToolShareableWorkspace = {
  id: string;
  name: string;
  access: 'owner' | 'admin';
};

export type CreateUserToolInput = {
  name: string;
  slug: string;
  description?: string | null;
  icon?: string;
  category?: string;
  executionType: 'webhook' | 'workflow';
  visibility?: 'private' | 'shared' | 'template' | 'published';
  status?: 'draft' | 'active' | 'archived';
  readOnly?: boolean;
  requiresConfirmation?: boolean;
  supportsAgent?: boolean;
  supportsManualRun?: boolean;
  initialVersion?: {
    inputSchema: UserToolField[];
    outputSchema?: UserToolField[];
    config: Record<string, unknown>;
    changeSummary?: string;
    isDraft?: boolean;
    activate?: boolean;
  };
};

export function useUserTools() {
  return useQuery<{ tools: UserToolListItem[] }>({
    queryKey: KEY,
    queryFn: async () => {
      const res = await fetch('/api/user-tools');
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ tools: UserToolListItem[] }>;
    },
  });
}

export function useUserToolDetail(toolId: string | null) {
  return useQuery<UserToolDetail>({
    queryKey: detailKey(toolId),
    queryFn: async () => {
      const res = await fetch(`/api/user-tools/${toolId}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<UserToolDetail>;
    },
    enabled: Boolean(toolId),
  });
}

export function useUserToolRuns(toolId: string | null) {
  return useQuery<{ runs: UserToolRun[] }>({
    queryKey: runsKey(toolId),
    queryFn: async () => {
      const res = await fetch(`/api/user-tools/${toolId}/runs`);
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ runs: UserToolRun[] }>;
    },
    enabled: Boolean(toolId),
  });
}

export function useUserToolShares(toolId: string | null) {
  return useQuery<{ shares: UserToolSharedUser[] }>({
    queryKey: sharesKey(toolId),
    queryFn: async () => {
      const res = await fetch(`/api/user-tools/${toolId}/share`);
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ shares: UserToolSharedUser[] }>;
    },
    enabled: Boolean(toolId),
  });
}

export function useUserToolWorkspaceShares(toolId: string | null) {
  return useQuery<{ workspaceShares: UserToolSharedWorkspace[] }>({
    queryKey: workspaceSharesKey(toolId),
    queryFn: async () => {
      const res = await fetch(`/api/user-tools/${toolId}/workspaces`);
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ workspaceShares: UserToolSharedWorkspace[] }>;
    },
    enabled: Boolean(toolId),
  });
}

export function useUserToolShareableWorkspaces() {
  return useQuery<{ workspaces: UserToolShareableWorkspace[] }>({
    queryKey: shareableWorkspacesKey,
    queryFn: async () => {
      const res = await fetch('/api/user-tools/workspaces');
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ workspaces: UserToolShareableWorkspace[] }>;
    },
  });
}

export function useCreateUserTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateUserToolInput) => {
      const res = await fetch('/api/user-tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ tool: UserToolListItem }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useUpdateUserTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ toolId, ...data }: {
      toolId: string;
      name?: string;
      slug?: string;
      description?: string | null;
      category?: string;
      executionType?: 'webhook' | 'workflow';
      readOnly?: boolean;
      requiresConfirmation?: boolean;
      supportsAgent?: boolean;
      supportsManualRun?: boolean;
    }) => {
      const res = await fetch(`/api/user-tools/${toolId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ tool: UserToolListItem }>;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: detailKey(variables.toolId) });
    },
  });
}

export function useCreateUserToolVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ toolId, ...data }: {
      toolId: string;
      inputSchema: UserToolField[];
      outputSchema?: UserToolField[];
      config: Record<string, unknown>;
      changeSummary?: string;
      isDraft?: boolean;
      activate?: boolean;
    }) => {
      const res = await fetch(`/api/user-tools/${toolId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ versionId: string }>;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: detailKey(variables.toolId) });
      qc.invalidateQueries({ queryKey: runsKey(variables.toolId) });
    },
  });
}

export function usePublishUserTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ toolId, version }: { toolId: string; version: number }) => {
      const res = await fetch(`/api/user-tools/${toolId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ success: true }>;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: detailKey(variables.toolId) });
      qc.invalidateQueries({ queryKey: runsKey(variables.toolId) });
    },
  });
}

export function useRunUserTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      toolId,
      input,
      mode,
      confirmed,
    }: {
      toolId: string;
      input: Record<string, unknown>;
      mode: 'test' | 'run';
      confirmed?: boolean;
    }) => {
      const res = await fetch(`/api/user-tools/${toolId}/${mode === 'test' ? 'test' : 'run'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, confirmed }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<Record<string, unknown>>;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: runsKey(variables.toolId) });
      qc.invalidateQueries({ queryKey: detailKey(variables.toolId) });
    },
  });
}

export function useAddUserToolShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ toolId, userId, role }: { toolId: string; userId: string; role: 'runner' | 'editor' }) => {
      const res = await fetch(`/api/user-tools/${toolId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to share tool' }));
        throw new Error(data.error ?? 'Failed to share tool');
      }
      return res.json() as Promise<{ shares: UserToolSharedUser[] }>;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: detailKey(variables.toolId) });
      qc.invalidateQueries({ queryKey: sharesKey(variables.toolId) });
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useRemoveUserToolShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ toolId, userId }: { toolId: string; userId: string }) => {
      const res = await fetch(`/api/user-tools/${toolId}/share`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to remove share' }));
        throw new Error(data.error ?? 'Failed to remove share');
      }
      return res.json() as Promise<{ shares: UserToolSharedUser[] }>;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: detailKey(variables.toolId) });
      qc.invalidateQueries({ queryKey: sharesKey(variables.toolId) });
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useAddUserToolWorkspaceShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      toolId,
      brandId,
      role,
    }: {
      toolId: string;
      brandId: string;
      role: 'runner' | 'editor';
    }) => {
      const res = await fetch(`/api/user-tools/${toolId}/workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to share tool with workspace' }));
        throw new Error(data.error ?? 'Failed to share tool with workspace');
      }
      return res.json() as Promise<{ workspaceShares: UserToolSharedWorkspace[] }>;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: detailKey(variables.toolId) });
      qc.invalidateQueries({ queryKey: workspaceSharesKey(variables.toolId) });
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useRemoveUserToolWorkspaceShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ toolId, brandId }: { toolId: string; brandId: string }) => {
      const res = await fetch(`/api/user-tools/${toolId}/workspaces`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to remove workspace share' }));
        throw new Error(data.error ?? 'Failed to remove workspace share');
      }
      return res.json() as Promise<{ workspaceShares: UserToolSharedWorkspace[] }>;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: detailKey(variables.toolId) });
      qc.invalidateQueries({ queryKey: workspaceSharesKey(variables.toolId) });
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
