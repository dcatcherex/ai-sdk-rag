'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircleIcon, CoinsIcon, SearchIcon, XCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type AdminUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  approved: boolean;
  balance: number;
  createdAt: string;
};

type UsersResponse = {
  users: AdminUser[];
  total: number;
  page: number;
  totalPages: number;
};

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pendingOnly, setPendingOnly] = useState(false);

  // Grant dialog state
  const [grantTarget, setGrantTarget] = useState<AdminUser | null>(null);
  const [grantAmount, setGrantAmount] = useState('100');
  const [grantDescription, setGrantDescription] = useState('');

  // Debounce search
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 400);
    setDebounceTimer(timer);
  };

  const { data, isLoading } = useQuery<UsersResponse>({
    queryKey: ['admin', 'users', { search: debouncedSearch, page, pendingOnly }],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (pendingOnly) params.set('pending', 'true');
      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
  });

  const approvalMutation = useMutation({
    mutationFn: async ({ userId, approved }: { userId: string; approved: boolean }) => {
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

  const grantMutation = useMutation({
    mutationFn: async ({
      userId,
      amount,
      description,
    }: {
      userId: string;
      amount: number;
      description?: string;
    }) => {
      const res = await fetch('/api/credits/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, amount, description }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Grant failed');
      }
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setGrantTarget(null);
      setGrantAmount('100');
      setGrantDescription('');
    },
  });

  const handleGrant = () => {
    if (!grantTarget) return;
    const amount = Number(grantAmount);
    if (!amount || amount <= 0) return;
    grantMutation.mutate({
      userId: grantTarget.id,
      amount,
      description: grantDescription || undefined,
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-sm text-muted-foreground">
          Manage users and grant credits
        </p>
      </div>

      {/* Search + filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant={pendingOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setPendingOnly((v) => !v); setPage(1); }}
        >
          Pending approval only
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-semibold text-foreground">User</TableHead>
              <TableHead className="font-semibold text-foreground">Email</TableHead>
              <TableHead className="font-semibold text-foreground">Status</TableHead>
              <TableHead className="text-right font-semibold text-foreground">Credits</TableHead>
              <TableHead className="font-semibold text-foreground">Joined</TableHead>
              <TableHead className="text-right font-semibold text-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : !data?.users?.length ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              data.users.map((u) => (
                <TableRow key={u.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    {u.approved ? (
                      <Badge variant="outline" className="gap-1 text-green-700 border-green-300">
                        <CheckCircleIcon className="size-3" />
                        Approved
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1 text-amber-700">
                        <XCircleIcon className="size-3" />
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={u.balance <= 0 ? 'destructive' : u.balance <= 10 ? 'secondary' : 'outline'}
                      className="font-mono"
                    >
                      {u.balance}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(u.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant={u.approved ? 'outline' : 'default'}
                        className="gap-1.5"
                        disabled={approvalMutation.isPending}
                        onClick={() => approvalMutation.mutate({ userId: u.id, approved: !u.approved })}
                      >
                        {u.approved ? (
                          <><XCircleIcon className="size-3.5" />Revoke</>
                        ) : (
                          <><CheckCircleIcon className="size-3.5" />Approve</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => setGrantTarget(u)}
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

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted-foreground">
            Page {data.page} of {data.totalPages} ({data.total} users)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Grant dialog */}
      <Dialog open={!!grantTarget} onOpenChange={(open) => !open && setGrantTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Credits</DialogTitle>
            <DialogDescription>
              Grant credits to{' '}
              <strong>{grantTarget?.name}</strong>{' '}
              ({grantTarget?.email}). Current balance:{' '}
              <strong>{grantTarget?.balance}</strong> credits.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Amount
              </label>
              <Input
                type="number"
                min={1}
                value={grantAmount}
                onChange={(e) => setGrantAmount(e.target.value)}
                placeholder="100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Description (optional)
              </label>
              <Input
                value={grantDescription}
                onChange={(e) => setGrantDescription(e.target.value)}
                placeholder="e.g. Monthly top-up"
              />
            </div>

            {grantMutation.isError && (
              <p className="text-sm text-destructive">
                {grantMutation.error?.message ?? 'Something went wrong'}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleGrant}
              disabled={grantMutation.isPending || !Number(grantAmount)}
            >
              {grantMutation.isPending ? 'Granting…' : `Grant ${grantAmount || 0} credits`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
