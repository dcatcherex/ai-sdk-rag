'use client';

import { useQuery } from '@tanstack/react-query';
import type {
  UsersResponse,
  InvitesResponse,
  UserDetail,
} from '../types';
import type { UsersFilters } from './use-users-filters';

export function useUsersQueries(f: UsersFilters) {
  const users = useQuery<UsersResponse>({
    queryKey: ['admin', 'users', {
      search: f.debouncedSearch,
      page: f.page,
      pendingOnly: f.pendingOnly,
      sortBy: f.sortBy,
    }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(f.page),
        limit: '20',
        sortBy: f.sortBy,
      });
      if (f.debouncedSearch) params.set('search', f.debouncedSearch);
      if (f.pendingOnly) params.set('pending', 'true');
      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
  });

  const invites = useQuery<InvitesResponse>({
    queryKey: ['admin', 'invites', {
      search: f.debouncedSearch,
      status: f.inviteStatusFilter,
      page: f.invitePage,
    }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(f.invitePage),
        limit: '20',
      });
      if (f.debouncedSearch) params.set('search', f.debouncedSearch);
      if (f.inviteStatusFilter !== 'all') params.set('status', f.inviteStatusFilter);
      const res = await fetch(`/api/admin/users/invite?${params}`);
      if (!res.ok) throw new Error('Failed to fetch invites');
      return res.json();
    },
  });

  const userDetail = useQuery<UserDetail>({
    queryKey: ['admin', 'user-detail', f.selectedUserId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${f.selectedUserId}/detail`);
      if (!res.ok) throw new Error('Failed to fetch user detail');
      return res.json();
    },
    enabled: !!f.selectedUserId && !!f.selectedUserId,
  });

  return { users, invites, userDetail };
}

export type UsersQueries = ReturnType<typeof useUsersQueries>;
