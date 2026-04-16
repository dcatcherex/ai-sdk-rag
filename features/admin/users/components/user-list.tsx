'use client';

import {
  CheckCircleIcon,
  CoinsIcon,
  XCircleIcon,
  ActivityIcon,
  ZapIcon,
  SearchIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate, formatRelative } from '../lib/formatters';
import { UserApprovalBadge, BalanceBadge } from './status-badges';
import type { AdminUser, SortBy } from '../types';
import type { UsersMutations } from '../hooks/use-users-mutations';

interface UserListProps {
  users: AdminUser[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  search: string;
  pendingOnly: boolean;
  sortBy: SortBy;
  mutations: UsersMutations;
  onSearchChange: (value: string) => void;
  onPendingOnlyChange: (value: boolean) => void;
  onSortByChange: (value: SortBy) => void;
  onPageChange: (page: number) => void;
  onSelectUser: (userId: string) => void;
  onGrantCredits: (user: AdminUser) => void;
}

export function UserList({
  users,
  total,
  page,
  totalPages,
  isLoading,
  search,
  pendingOnly,
  sortBy,
  mutations,
  onSearchChange,
  onPendingOnlyChange,
  onSortByChange,
  onPageChange,
  onSelectUser,
  onGrantCredits,
}: UserListProps) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Existing users</h2>
        <p className="text-sm text-muted-foreground">Approval and credit controls for active accounts.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant={pendingOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => onPendingOnlyChange(!pendingOnly)}
        >
          Pending approval only
        </Button>
        <Select value={sortBy} onValueChange={(v) => onSortByChange(v as SortBy)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="joined">Sort: Joined</SelectItem>
            <SelectItem value="lastActive">Sort: Last Active</SelectItem>
            <SelectItem value="runs">Sort: Most Runs</SelectItem>
            <SelectItem value="creditsUsed">Sort: Credits Used</SelectItem>
            <SelectItem value="balance">Sort: Balance</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-semibold text-foreground">User</TableHead>
              <TableHead className="font-semibold text-foreground">Status</TableHead>
              <TableHead className="font-semibold text-foreground">
                <span className="flex items-center gap-1.5">
                  <ActivityIcon className="size-3.5" />
                  Last Active
                </span>
              </TableHead>
              <TableHead className="font-semibold text-foreground">
                <span className="flex items-center gap-1.5">
                  <ZapIcon className="size-3.5" />
                  Runs
                </span>
              </TableHead>
              <TableHead className="text-right font-semibold text-foreground">Used</TableHead>
              <TableHead className="text-right font-semibold text-foreground">Balance</TableHead>
              <TableHead className="font-semibold text-foreground">Joined</TableHead>
              <TableHead className="text-right font-semibold text-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Loading users...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow
                  key={user.id}
                  className="cursor-pointer hover:bg-muted/30"
                  onClick={() => onSelectUser(user.id)}
                >
                  <TableCell className="font-medium">
                    <div>{user.name}</div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </TableCell>
                  <TableCell>
                    <UserApprovalBadge approved={user.approved} />
                  </TableCell>
                  <TableCell className="text-sm">
                    {user.lastActiveAt ? (
                      <span className="text-foreground">{formatRelative(user.lastActiveAt)}</span>
                    ) : (
                      <span className="text-muted-foreground">Never</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {user.totalRuns > 0 ? user.totalRuns : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {user.creditsUsed > 0 ? (
                      <span className="text-red-600">{user.creditsUsed}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <BalanceBadge balance={user.balance} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(user.createdAt)}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant={user.approved ? 'outline' : 'default'}
                        className="gap-1.5"
                        disabled={mutations.approval.isPending}
                        onClick={() =>
                          mutations.approval.mutate({
                            userId: user.id,
                            approved: !user.approved,
                          })
                        }
                      >
                        {user.approved ? (
                          <>
                            <XCircleIcon className="size-3.5" />
                            Revoke
                          </>
                        ) : (
                          <>
                            <CheckCircleIcon className="size-3.5" />
                            Approve
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => onGrantCredits(user)}
                      >
                        <CoinsIcon className="size-3.5" />
                        Grant
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 ? (
        <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted-foreground">
            Page {page} of {totalPages} ({total} users)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
