'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActivityIcon,
  CheckCircleIcon,
  CoinsIcon,
  Loader2Icon,
  MailPlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SendIcon,
  XCircleIcon,
  ZapIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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

// ── Types ─────────────────────────────────────────────────────────────────────

type SortBy = 'joined' | 'lastActive' | 'runs' | 'creditsUsed' | 'balance';

type AdminUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  approved: boolean;
  balance: number;
  createdAt: string;
  lastActiveAt: string | null;
  totalRuns: number;
  creditsUsed: number;
};

type UsersResponse = {
  users: AdminUser[];
  total: number;
  page: number;
  totalPages: number;
};

type AdminInvite = {
  id: string;
  email: string;
  name: string | null;
  status: 'invited' | 'accepted' | 'expired' | 'cancelled';
  invitedByUserName: string | null;
  invitedByUserEmail: string | null;
  approvedOnAccept: boolean;
  initialCreditGrant: number;
  expiresAt: string;
  acceptedAt: string | null;
  acceptedUserName: string | null;
  acceptedUserEmail: string | null;
  cancelledAt: string | null;
  lastSentAt: string | null;
  creditGrantedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type InvitesResponse = {
  invites: AdminInvite[];
  total: number;
  page: number;
  totalPages: number;
};

type InviteStatusFilter = 'all' | AdminInvite['status'];

type RunEntry = {
  id: string;
  type: 'chat' | 'tool' | 'workspace';
  status: string;
  label: string;
  detail: string | null;
  createdAt: string;
};

type Transaction = {
  id: string;
  amount: number;
  balance: number;
  type: string;
  description: string | null;
  createdAt: string;
};

type UserDetail = {
  user: {
    id: string;
    name: string;
    email: string;
    createdAt: string;
    balance: number;
  };
  stats: {
    totalRuns: number;
    creditsUsed: number;
    lastActiveAt: string | null;
  };
  recentRuns: RunEntry[];
  recentTransactions: Transaction[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatRelative(dateStr: string | null) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(dateStr);
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'success') {
    return (
      <Badge variant="outline" className="border-green-300 text-green-700">
        Success
      </Badge>
    );
  }
  if (status === 'error') {
    return <Badge variant="destructive">Error</Badge>;
  }
  return <Badge variant="secondary" className="capitalize">{status}</Badge>;
}

function RunTypeBadge({ type }: { type: RunEntry['type'] }) {
  const map = {
    chat: 'bg-indigo-100 text-indigo-700',
    tool: 'bg-amber-100 text-amber-700',
    workspace: 'bg-violet-100 text-violet-700',
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${map[type]}`}>
      {type}
    </span>
  );
}

// ── User Detail Dialog ────────────────────────────────────────────────────────

function UserDetailDialog({
  userId,
  open,
  onOpenChange,
}: {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useQuery<UserDetail>({
    queryKey: ['admin', 'user-detail', userId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/detail`);
      if (!res.ok) throw new Error('Failed to fetch user detail');
      return res.json();
    },
    enabled: !!userId && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {isLoading ? 'Loading...' : (data?.user.name ?? 'User Detail')}
          </DialogTitle>
          <DialogDescription>
            {data?.user.email ?? 'Activity, runs, and credit history'}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Loading user detail...
          </div>
        ) : (
          <ScrollArea className="max-h-[65vh] pr-4">
            <div className="space-y-6">
              {/* KPI row */}
              <div className="grid gap-3 sm:grid-cols-4">
                <Card>
                  <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Total Runs</CardTitle></CardHeader>
                  <CardContent className="text-xl font-bold">{data.stats.totalRuns}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Credits Used</CardTitle></CardHeader>
                  <CardContent className="text-xl font-bold">{data.stats.creditsUsed}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Balance</CardTitle></CardHeader>
                  <CardContent className="text-xl font-bold">{data.user.balance}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Last Active</CardTitle></CardHeader>
                  <CardContent className="text-sm font-medium">{formatRelative(data.stats.lastActiveAt)}</CardContent>
                </Card>
              </div>

              {/* Recent Runs */}
              <div className="space-y-2">
                <div className="text-sm font-semibold">Recent Runs</div>
                {data.recentRuns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No runs yet.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead>Type</TableHead>
                          <TableHead>Label</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>When</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.recentRuns.map((run) => (
                          <TableRow key={run.id} className="hover:bg-muted/30">
                            <TableCell><RunTypeBadge type={run.type} /></TableCell>
                            <TableCell className="text-sm">
                              <div className="capitalize">{run.label}</div>
                              {run.detail && <div className="text-xs text-muted-foreground">{run.detail}</div>}
                            </TableCell>
                            <TableCell><StatusBadge status={run.status} /></TableCell>
                            <TableCell className="text-sm text-muted-foreground">{formatRelative(run.createdAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Recent Transactions */}
              <div className="space-y-2">
                <div className="text-sm font-semibold">Recent Credit Transactions</div>
                {data.recentTransactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No transactions yet.</p>
                ) : (
                  <div className="space-y-1">
                    {data.recentTransactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                        <div className="flex items-center gap-3">
                          <span className={tx.amount >= 0 ? 'font-medium text-green-600' : 'font-medium text-red-500'}>
                            {tx.amount >= 0 ? '+' : ''}{tx.amount}
                          </span>
                          <span className="text-muted-foreground">{tx.description ?? tx.type}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>bal {tx.balance}</span>
                          <span>{formatRelative(tx.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('joined');
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const [grantTarget, setGrantTarget] = useState<AdminUser | null>(null);
  const [grantAmount, setGrantAmount] = useState('100');
  const [grantDescription, setGrantDescription] = useState('');

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteCredits, setInviteCredits] = useState('0');
  const [inviteExpiresInDays, setInviteExpiresInDays] = useState('7');
  const [inviteApprovedOnAccept, setInviteApprovedOnAccept] = useState(true);
  const [inviteStatusFilter, setInviteStatusFilter] = useState<InviteStatusFilter>('all');
  const [invitePage, setInvitePage] = useState(1);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
      setInvitePage(1);
    }, 400);
    setDebounceTimer(timer);
  };

  const { data, isLoading } = useQuery<UsersResponse>({
    queryKey: ['admin', 'users', { search: debouncedSearch, page, pendingOnly, sortBy }],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20', sortBy });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (pendingOnly) params.set('pending', 'true');
      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
  });

  const { data: invitesData, isLoading: invitesLoading } = useQuery<InvitesResponse>({
    queryKey: ['admin', 'invites', { search: debouncedSearch, status: inviteStatusFilter, page: invitePage }],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(invitePage), limit: '20' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (inviteStatusFilter !== 'all') params.set('status', inviteStatusFilter);
      const res = await fetch(`/api/admin/users/invite?${params}`);
      if (!res.ok) throw new Error('Failed to fetch invites');
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
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? 'Grant failed');
      return body;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setGrantTarget(null);
      setGrantAmount('100');
      setGrantDescription('');
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          name: inviteName || undefined,
          approvedOnAccept: inviteApprovedOnAccept,
          initialCreditGrant: Number(inviteCredits || '0'),
          expiresInDays: Number(inviteExpiresInDays || '7'),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? 'Failed to create invite');
      return body;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'invites'] });
      setInvitePage(1);
      setInviteDialogOpen(false);
      setInviteEmail('');
      setInviteName('');
      setInviteCredits('0');
      setInviteExpiresInDays('7');
      setInviteApprovedOnAccept(true);
    },
  });

  const resendInviteMutation = useMutation({
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

  const cancelInviteMutation = useMutation({
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

  const mutationError = useMemo(
    () =>
      inviteMutation.error?.message ||
      resendInviteMutation.error?.message ||
      cancelInviteMutation.error?.message ||
      null,
    [cancelInviteMutation.error?.message, inviteMutation.error?.message, resendInviteMutation.error?.message],
  );

  const handleGrant = () => {
    if (!grantTarget) return;
    const amount = Number(grantAmount);
    if (!amount || amount <= 0) return;
    grantMutation.mutate({ userId: grantTarget.id, amount, description: grantDescription || undefined });
  };

  const inviteStatusBadge = (status: AdminInvite['status']) => {
    if (status === 'accepted') {
      return (
        <Badge variant="outline" className="gap-1 border-green-300 text-green-700">
          <CheckCircleIcon className="size-3" />
          Accepted
        </Badge>
      );
    }
    if (status === 'expired') return <Badge variant="secondary">Expired</Badge>;
    if (status === 'cancelled') {
      return (
        <Badge variant="outline" className="gap-1 border-zinc-300 text-zinc-700">
          <XCircleIcon className="size-3" />
          Cancelled
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1 border-blue-300 text-blue-700">
        <SendIcon className="size-3" />
        Invited
      </Badge>
    );
  };

  const inviteAuditSummary = (invite: AdminInvite) => {
    if (invite.status === 'accepted') {
      return {
        title: `Accepted ${formatDate(invite.acceptedAt)}`,
        subtitle: invite.acceptedUserEmail ?? invite.acceptedUserName ?? 'Accepted account',
      };
    }
    if (invite.status === 'cancelled') {
      return {
        title: `Cancelled ${formatDate(invite.cancelledAt)}`,
        subtitle: invite.invitedByUserEmail ?? invite.invitedByUserName ?? 'Admin action',
      };
    }
    if (invite.status === 'expired') {
      return {
        title: `Expired ${formatDate(invite.expiresAt)}`,
        subtitle: invite.lastSentAt ? `Last sent ${formatDate(invite.lastSentAt)}` : `Created ${formatDate(invite.createdAt)}`,
      };
    }
    return {
      title: `Sent ${formatDate(invite.lastSentAt || invite.createdAt)}`,
      subtitle: invite.invitedByUserEmail ?? invite.invitedByUserName ?? 'Admin action',
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage users, grant credits, and onboard people through admin invites.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setInviteDialogOpen(true)}>
          <MailPlusIcon className="size-4" />
          Invite User
        </Button>
      </div>

      {/* ── Existing Users ── */}
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
          <Select value={sortBy} onValueChange={(v) => { setSortBy(v as SortBy); setPage(1); }}>
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
              ) : !data?.users?.length ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                data.users.map((userRow) => (
                  <TableRow
                    key={userRow.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => setSelectedUserId(userRow.id)}
                  >
                    <TableCell className="font-medium">
                      <div>{userRow.name}</div>
                      <div className="text-xs text-muted-foreground">{userRow.email}</div>
                    </TableCell>
                    <TableCell>
                      {userRow.approved ? (
                        <Badge variant="outline" className="gap-1 border-green-300 text-green-700">
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
                    <TableCell className="text-sm">
                      {userRow.lastActiveAt ? (
                        <span className="text-foreground">{formatRelative(userRow.lastActiveAt)}</span>
                      ) : (
                        <span className="text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {userRow.totalRuns > 0 ? userRow.totalRuns : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {userRow.creditsUsed > 0 ? (
                        <span className="text-red-600">{userRow.creditsUsed}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={userRow.balance <= 0 ? 'destructive' : userRow.balance <= 10 ? 'secondary' : 'outline'}
                        className="font-mono"
                      >
                        {userRow.balance}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(userRow.createdAt)}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant={userRow.approved ? 'outline' : 'default'}
                          className="gap-1.5"
                          disabled={approvalMutation.isPending}
                          onClick={() => approvalMutation.mutate({ userId: userRow.id, approved: !userRow.approved })}
                        >
                          {userRow.approved ? (
                            <><XCircleIcon className="size-3.5" />Revoke</>
                          ) : (
                            <><CheckCircleIcon className="size-3.5" />Approve</>
                          )}
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setGrantTarget(userRow)}>
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

        {data && data.totalPages > 1 ? (
          <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-muted-foreground">
              Page {data.page} of {data.totalPages} ({data.total} users)
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((v) => v - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((v) => v + 1)}>
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      {/* ── Invites ── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Invites</h2>
          <p className="text-sm text-muted-foreground">Track pending, accepted, expired, and cancelled admin invites.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['all', 'invited', 'accepted', 'expired', 'cancelled'] as const).map((status) => (
            <Button
              key={status}
              size="sm"
              variant={inviteStatusFilter === status ? 'default' : 'outline'}
              onClick={() => { setInviteStatusFilter(status); setInvitePage(1); }}
            >
              {status === 'all' ? 'All invites' : status[0]!.toUpperCase() + status.slice(1)}
            </Button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-semibold text-foreground">Invitee</TableHead>
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className="font-semibold text-foreground">Audit</TableHead>
                <TableHead className="font-semibold text-foreground">Credits</TableHead>
                <TableHead className="font-semibold text-foreground">Expires</TableHead>
                <TableHead className="text-right font-semibold text-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitesLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Loading invites...
                  </TableCell>
                </TableRow>
              ) : !invitesData?.invites?.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No invites found
                  </TableCell>
                </TableRow>
              ) : (
                invitesData.invites.map((invite) => {
                  const auditSummary = inviteAuditSummary(invite);
                  return (
                    <TableRow key={invite.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="font-medium">{invite.name || 'Unnamed invite'}</div>
                        <div className="text-sm text-muted-foreground">{invite.email}</div>
                      </TableCell>
                      <TableCell>{inviteStatusBadge(invite.status)}</TableCell>
                      <TableCell>
                        <div className="font-medium">{auditSummary.title}</div>
                        <div className="text-xs text-muted-foreground">{auditSummary.subtitle}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{invite.initialCreditGrant}</div>
                        <div className="text-xs text-muted-foreground">
                          {invite.approvedOnAccept ? 'Auto-approve on accept' : 'Approval remains pending'}
                          {invite.creditGrantedAt ? ` | Granted ${formatDate(invite.creditGrantedAt)}` : ''}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(invite.expiresAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            disabled={invite.status !== 'invited' || resendInviteMutation.isPending}
                            onClick={() => resendInviteMutation.mutate(invite.id)}
                          >
                            <RefreshCwIcon className="size-3.5" />
                            Resend
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            disabled={invite.status !== 'invited' || cancelInviteMutation.isPending}
                            onClick={() => cancelInviteMutation.mutate(invite.id)}
                          >
                            <XCircleIcon className="size-3.5" />
                            Cancel
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {invitesData && invitesData.totalPages > 1 ? (
          <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-muted-foreground">
              Page {invitesData.page} of {invitesData.totalPages} ({invitesData.total} invites)
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={invitePage <= 1} onClick={() => setInvitePage((v) => v - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={invitePage >= invitesData.totalPages} onClick={() => setInvitePage((v) => v + 1)}>
                Next
              </Button>
            </div>
          </div>
        ) : null}

        {mutationError ? <p className="text-sm text-destructive">{mutationError}</p> : null}
      </section>

      {/* ── User Detail Dialog ── */}
      <UserDetailDialog
        userId={selectedUserId}
        open={!!selectedUserId}
        onOpenChange={(open) => !open && setSelectedUserId(null)}
      />

      {/* ── Grant Credits Dialog ── */}
      <Dialog open={!!grantTarget} onOpenChange={(open) => !open && setGrantTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Credits</DialogTitle>
            <DialogDescription>
              Grant credits to <strong>{grantTarget?.name}</strong> ({grantTarget?.email}). Current balance:{' '}
              <strong>{grantTarget?.balance}</strong> credits.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Amount</label>
              <Input type="number" min={1} value={grantAmount} onChange={(e) => setGrantAmount(e.target.value)} placeholder="100" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Description (optional)</label>
              <Input value={grantDescription} onChange={(e) => setGrantDescription(e.target.value)} placeholder="e.g. Monthly top-up" />
            </div>
            {grantMutation.isError ? (
              <p className="text-sm text-destructive">{grantMutation.error?.message ?? 'Something went wrong'}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantTarget(null)}>Cancel</Button>
            <Button onClick={handleGrant} disabled={grantMutation.isPending || !Number(grantAmount)}>
              {grantMutation.isPending ? 'Granting...' : `Grant ${grantAmount || 0} credits`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Invite User Dialog ── */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite user</DialogTitle>
            <DialogDescription>
              Send an admin-managed invite that the user can accept with their existing auth method.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Email</label>
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="name@example.com" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Name (optional)</label>
              <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Display name" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Initial credits</label>
                <Input type="number" min={0} value={inviteCredits} onChange={(e) => setInviteCredits(e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Expires in days</label>
                <Input type="number" min={1} max={30} value={inviteExpiresInDays} onChange={(e) => setInviteExpiresInDays(e.target.value)} placeholder="7" />
              </div>
            </div>
            <label className="flex items-center gap-3 rounded-lg border p-3 text-sm">
              <Checkbox checked={inviteApprovedOnAccept} onCheckedChange={(v) => setInviteApprovedOnAccept(v === true)} />
              Auto-approve this user when they accept the invite
            </label>
            {inviteMutation.isError ? (
              <p className="text-sm text-destructive">{inviteMutation.error?.message ?? 'Failed to send invite'}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => inviteMutation.mutate()} disabled={inviteMutation.isPending || !inviteEmail.trim()}>
              {inviteMutation.isPending ? 'Sending...' : 'Send invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
