'use client';

import { useState, useCallback } from 'react';
import type { SortBy, InviteStatusFilter } from '../types';

export function useUsersFilters() {
  // Search and filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('joined');

  // Invite filters
  const [inviteStatusFilter, setInviteStatusFilter] = useState<InviteStatusFilter>('all');
  const [invitePage, setInvitePage] = useState(1);

  // Dialog states
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [grantTarget, setGrantTarget] = useState<{ id: string; name: string; email: string; balance: number } | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; email: string } | null>(null);

  // Debounce search
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    // Clear any existing timer and set new one
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
      setInvitePage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // Reset pagination when filters change
  const handlePendingOnlyChange = useCallback((value: boolean) => {
    setPendingOnly(value);
    setPage(1);
  }, []);

  const handleSortByChange = useCallback((value: SortBy) => {
    setSortBy(value);
    setPage(1);
  }, []);

  const handleInviteStatusFilterChange = useCallback((value: InviteStatusFilter) => {
    setInviteStatusFilter(value);
    setInvitePage(1);
  }, []);

  return {
    // Search
    search,
    setSearch,
    debouncedSearch,
    handleSearchChange,

    // Pagination - Users
    page,
    setPage,

    // Filters - Users
    pendingOnly,
    setPendingOnly: handlePendingOnlyChange,
    sortBy,
    setSortBy: handleSortByChange,

    // Pagination - Invites
    invitePage,
    setInvitePage,

    // Filters - Invites
    inviteStatusFilter,
    setInviteStatusFilter: handleInviteStatusFilterChange,

    // Dialog states
    selectedUserId,
    setSelectedUserId,
    grantTarget,
    setGrantTarget,
    inviteDialogOpen,
    setInviteDialogOpen,
    deleteTarget,
    setDeleteTarget,
  };
}

export type UsersFilters = ReturnType<typeof useUsersFilters>;
