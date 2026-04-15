'use client';

import { useQuery } from '@tanstack/react-query';
import type {
  AdminAiTrendsResponse,
  AdminChatRunDetail,
  AdminChatRunsResponse,
  AdminToolRunDetail,
  AdminToolRunsResponse,
  AdminUnifiedRunsResponse,
  AdminWorkspaceAiRunDetail,
  AdminWorkspaceAiRunsResponse,
} from '../types';
import type { AiRunsFilters } from './use-ai-runs-filters';

export function useAiRunsQueries(f: AiRunsFilters) {
  const chat = useQuery<AdminChatRunsResponse>({
    queryKey: ['admin', 'chat-runs', {
      search: f.chatSearch, status: f.chatStatus, routeKind: f.chatRouteKind,
      resolvedModelId: f.chatResolvedModelId, dateFrom: f.dateFrom, dateTo: f.dateTo, page: f.chatPage,
    }],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(f.chatPage), limit: '20' });
      if (f.chatSearch.trim()) p.set('search', f.chatSearch.trim());
      if (f.chatStatus !== 'all') p.set('status', f.chatStatus);
      if (f.chatRouteKind !== 'all') p.set('routeKind', f.chatRouteKind);
      if (f.chatResolvedModelId !== 'all') p.set('resolvedModelId', f.chatResolvedModelId);
      if (f.dateFrom) p.set('dateFrom', f.dateFrom);
      if (f.dateTo) p.set('dateTo', f.dateTo);
      const res = await fetch(`/api/admin/chat-runs?${p}`);
      if (!res.ok) throw new Error('Failed to fetch chat runs');
      return res.json();
    },
  });

  const chatDetail = useQuery<AdminChatRunDetail>({
    queryKey: ['admin', 'chat-runs', 'detail', f.selectedChatRunId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/chat-runs/${f.selectedChatRunId}`);
      if (!res.ok) throw new Error('Failed to fetch chat run detail');
      return res.json();
    },
    enabled: !!f.selectedChatRunId,
  });

  const workspace = useQuery<AdminWorkspaceAiRunsResponse>({
    queryKey: ['admin', 'workspace-ai-runs', {
      search: f.workspaceSearch, status: f.workspaceStatus, route: f.workspaceRoute,
      kind: f.workspaceKind, modelId: f.workspaceModelId, dateFrom: f.dateFrom, dateTo: f.dateTo, page: f.workspacePage,
    }],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(f.workspacePage), limit: '20' });
      if (f.workspaceSearch.trim()) p.set('search', f.workspaceSearch.trim());
      if (f.workspaceStatus !== 'all') p.set('status', f.workspaceStatus);
      if (f.workspaceRoute !== 'all') p.set('route', f.workspaceRoute);
      if (f.workspaceKind !== 'all') p.set('kind', f.workspaceKind);
      if (f.workspaceModelId !== 'all') p.set('modelId', f.workspaceModelId);
      if (f.dateFrom) p.set('dateFrom', f.dateFrom);
      if (f.dateTo) p.set('dateTo', f.dateTo);
      const res = await fetch(`/api/admin/workspace-ai-runs?${p}`);
      if (!res.ok) throw new Error('Failed to fetch workspace AI runs');
      return res.json();
    },
  });

  const workspaceDetail = useQuery<AdminWorkspaceAiRunDetail>({
    queryKey: ['admin', 'workspace-ai-runs', 'detail', f.selectedWorkspaceRunId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/workspace-ai-runs/${f.selectedWorkspaceRunId}`);
      if (!res.ok) throw new Error('Failed to fetch workspace AI run detail');
      return res.json();
    },
    enabled: !!f.selectedWorkspaceRunId,
  });

  const tool = useQuery<AdminToolRunsResponse>({
    queryKey: ['admin', 'tool-runs', {
      search: f.toolSearch, status: f.toolStatus, slug: f.toolSlug,
      source: f.toolSource, dateFrom: f.dateFrom, dateTo: f.dateTo, page: f.toolPage,
    }],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(f.toolPage), limit: '20' });
      if (f.toolSearch.trim()) p.set('search', f.toolSearch.trim());
      if (f.toolStatus !== 'all') p.set('status', f.toolStatus);
      if (f.toolSlug !== 'all') p.set('toolSlug', f.toolSlug);
      if (f.toolSource !== 'all') p.set('source', f.toolSource);
      if (f.dateFrom) p.set('dateFrom', f.dateFrom);
      if (f.dateTo) p.set('dateTo', f.dateTo);
      const res = await fetch(`/api/admin/tool-runs?${p}`);
      if (!res.ok) throw new Error('Failed to fetch tool runs');
      return res.json();
    },
  });

  const toolDetail = useQuery<AdminToolRunDetail>({
    queryKey: ['admin', 'tool-runs', 'detail', f.selectedToolRunId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/tool-runs/${f.selectedToolRunId}`);
      if (!res.ok) throw new Error('Failed to fetch tool run detail');
      return res.json();
    },
    enabled: !!f.selectedToolRunId,
  });

  const all = useQuery<AdminUnifiedRunsResponse>({
    queryKey: ['admin', 'ai-runs', {
      search: f.allSearch, status: f.allStatus, runtime: f.allRuntime,
      dateFrom: f.dateFrom, dateTo: f.dateTo, page: f.allPage,
    }],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(f.allPage), limit: '20' });
      if (f.allSearch.trim()) p.set('search', f.allSearch.trim());
      if (f.allStatus !== 'all') p.set('status', f.allStatus);
      if (f.allRuntime !== 'all') p.set('runtime', f.allRuntime);
      if (f.dateFrom) p.set('dateFrom', f.dateFrom);
      if (f.dateTo) p.set('dateTo', f.dateTo);
      const res = await fetch(`/api/admin/ai-runs?${p}`);
      if (!res.ok) throw new Error('Failed to fetch unified AI runs');
      return res.json();
    },
  });

  const trends = useQuery<AdminAiTrendsResponse>({
    queryKey: ['admin', 'ai-runs', 'trends', { dateFrom: f.dateFrom, dateTo: f.dateTo }],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (f.dateFrom) p.set('dateFrom', f.dateFrom);
      if (f.dateTo) p.set('dateTo', f.dateTo);
      const res = await fetch(`/api/admin/ai-runs/trends?${p}`);
      if (!res.ok) throw new Error('Failed to fetch AI trends');
      return res.json();
    },
  });

  return { chat, chatDetail, workspace, workspaceDetail, tool, toolDetail, all, trends };
}

export type AiRunsQueries = ReturnType<typeof useAiRunsQueries>;
