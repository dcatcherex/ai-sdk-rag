'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  UpdateApprovalInput,
  GrantCreditsInput,
  CreateInviteInput,
} from '../types';

export function useUsersMutations() {
  const queryClient = useQueryClient();

  const approval = useMutation({
    mutationFn: async ({ userId, approved }: UpdateApprovalInput) => {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, approved }),
      });
      if (!res.ok) throw new Error('Failed to update approval');
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const grantCredits = useMutation({
    mutationFn: async ({ userId, amount, description }: GrantCreditsInput) => {
      const res = await fetch('/api/credits/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, amount, description }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? 'Grant failed');
      return body;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'user-detail'] });
    },
  });

  const createInvite = useMutation({
    mutationFn: async (input: CreateInviteInput) => {
      const res = await fetch('/api/admin/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? 'Failed to create invite');
      return body;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'invites'] });
    },
  });

  const resendInvite = useMutation({
    mutationFn: async (inviteId: string) => {
      const res = await fetch(`/api/admin/users/invite/${inviteId}/resend`, { method: 'POST' });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? 'Failed to resend invite');
      return body;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'invites'] });
    },
  });

  const cancelInvite = useMutation({
    mutationFn: async (inviteId: string) => {
      const res = await fetch(`/api/admin/users/invite/${inviteId}/cancel`, { method: 'POST' });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? 'Failed to cancel invite');
      return body;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'invites'] });
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? 'Failed to delete user');
      return body;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'invites'] });
    },
  });

  return {
    approval,
    grantCredits,
    createInvite,
    resendInvite,
    cancelInvite,
    deleteUser,
  };
}

export type UsersMutations = ReturnType<typeof useUsersMutations>;
