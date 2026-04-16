'use client';

import { useMemo } from 'react';
import { MailPlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserList, InvitesList, UserDetailDialog, GrantCreditsDialog, InviteDialog } from '@/features/admin/users/components';
import { useUsersFilters, useUsersQueries, useUsersMutations } from '@/features/admin/users/hooks';

export default function AdminUsersPage() {
  // State management
  const f = useUsersFilters();
  const q = useUsersQueries(f);
  const m = useUsersMutations();

  // Collect mutation errors
  const mutationError = useMemo(
    () =>
      m.createInvite.error?.message ||
      m.resendInvite.error?.message ||
      m.cancelInvite.error?.message ||
      null,
    [m.createInvite.error?.message, m.resendInvite.error?.message, m.cancelInvite.error?.message],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage users, grant credits, and onboard people through admin invites.
          </p>
        </div>
        <Button className="gap-2" onClick={() => f.setInviteDialogOpen(true)}>
          <MailPlusIcon className="size-4" />
          Invite User
        </Button>
      </div>

      {/* Users List */}
      <UserList
        users={q.users.data?.users ?? []}
        total={q.users.data?.total ?? 0}
        page={q.users.data?.page ?? 1}
        totalPages={q.users.data?.totalPages ?? 1}
        isLoading={q.users.isLoading}
        search={f.search}
        pendingOnly={f.pendingOnly}
        sortBy={f.sortBy}
        mutations={m}
        onSearchChange={f.handleSearchChange}
        onPendingOnlyChange={f.setPendingOnly}
        onSortByChange={f.setSortBy}
        onPageChange={f.setPage}
        onSelectUser={f.setSelectedUserId}
        onGrantCredits={(user) =>
          f.setGrantTarget({ id: user.id, name: user.name, email: user.email, balance: user.balance })
        }
      />

      {/* Invites List */}
      <InvitesList
        invites={q.invites.data?.invites ?? []}
        total={q.invites.data?.total ?? 0}
        page={q.invites.data?.page ?? 1}
        totalPages={q.invites.data?.totalPages ?? 1}
        isLoading={q.invites.isLoading}
        statusFilter={f.inviteStatusFilter}
        mutations={m}
        onStatusFilterChange={f.setInviteStatusFilter}
        onPageChange={f.setInvitePage}
      />

      {/* Error display */}
      {mutationError ? <p className="text-sm text-destructive">{mutationError}</p> : null}

      {/* Dialogs */}
      <UserDetailDialog
        userId={f.selectedUserId}
        open={!!f.selectedUserId}
        onOpenChange={(open) => !open && f.setSelectedUserId(null)}
        data={q.userDetail.data}
        isLoading={q.userDetail.isLoading}
      />

      <GrantCreditsDialog
        target={f.grantTarget}
        open={!!f.grantTarget}
        onOpenChange={(open) => !open && f.setGrantTarget(null)}
        mutations={m}
      />

      <InviteDialog open={f.inviteDialogOpen} onOpenChange={f.setInviteDialogOpen} mutations={m} />
    </div>
  );
}
