'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { WorkspaceMemberRole, ApprovalStatus } from '../types';

// ── Workspace Members ─────────────────────────────────────────────────────────

export function useWorkspaceMembers(brandId: string) {
  return useQuery({
    queryKey: ['workspace-members', brandId],
    queryFn: async () => {
      const res = await fetch(`/api/brands/${brandId}/workspace`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!brandId,
  });
}

export function useAddWorkspaceMember(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { userId: string; role: WorkspaceMemberRole }) => {
      const res = await fetch(`/api/brands/${brandId}/workspace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspace-members', brandId] }),
  });
}

export function useUpdateMemberRole(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { userId: string; role: WorkspaceMemberRole }) => {
      const res = await fetch(`/api/brands/${brandId}/workspace/${data.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: data.role }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspace-members', brandId] }),
  });
}

export function useRemoveWorkspaceMember(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/brands/${brandId}/workspace/${userId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspace-members', brandId] }),
  });
}

// ── Approvals ─────────────────────────────────────────────────────────────────

export function useApprovalQueue(brandId: string) {
  return useQuery({
    queryKey: ['approval-queue', brandId],
    queryFn: async () => {
      const res = await fetch(`/api/approvals?brandId=${brandId}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!brandId,
  });
}

export function useRequestApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      contentPieceId: string;
      brandId?: string | null;
      assigneeId?: string | null;
      dueAt?: string | null;
    }) => {
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approval-queue'] }),
  });
}

export function useResolveApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      id: string;
      status: 'approved' | 'rejected' | 'changes_requested';
      note?: string;
    }) => {
      const res = await fetch(`/api/approvals/${data.id}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: data.status, note: data.note }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approval-queue'] }),
  });
}

// ── Comments ──────────────────────────────────────────────────────────────────

export function useContentComments(contentPieceId: string) {
  return useQuery({
    queryKey: ['content-comments', contentPieceId],
    queryFn: async () => {
      const res = await fetch(`/api/content-pieces/${contentPieceId}/comments`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!contentPieceId,
  });
}

export function useAddComment(contentPieceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { body: string; parentId?: string | null }) => {
      const res = await fetch(`/api/content-pieces/${contentPieceId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['content-comments', contentPieceId] }),
  });
}

export function useResolveComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => {
      const res = await fetch(`/api/comments/${commentId}/resolve`, {
        method: 'PATCH',
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['content-comments'] }),
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['content-comments'] }),
  });
}
