'use client';

import { Loader2Icon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate, formatRelative } from '../../lib/formatters';
import { RunStatusBadge, RunTypeBadge } from '../status-badges';
import type { UserDetail, Transaction } from '../../types';

interface UserDetailDialogProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: UserDetail | undefined;
  isLoading: boolean;
}

export function UserDetailDialog({
  userId,
  open,
  onOpenChange,
  data,
  isLoading,
}: UserDetailDialogProps) {
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
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs text-muted-foreground">Total Runs</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xl font-bold">{data.stats.totalRuns}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs text-muted-foreground">Credits Used</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xl font-bold">{data.stats.creditsUsed}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs text-muted-foreground">Balance</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xl font-bold">{data.user.balance}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs text-muted-foreground">Last Active</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm font-medium">
                    {formatRelative(data.stats.lastActiveAt)}
                  </CardContent>
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
                            <TableCell>
                              <RunTypeBadge type={run.type} />
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="capitalize">{run.label}</div>
                              {run.detail && (
                                <div className="text-xs text-muted-foreground">{run.detail}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              <RunStatusBadge status={run.status} />
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatRelative(run.createdAt)}
                            </TableCell>
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
                      <TransactionRow key={tx.id} transaction={tx} />
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

function TransactionRow({ transaction: tx }: { transaction: Transaction }) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
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
  );
}
