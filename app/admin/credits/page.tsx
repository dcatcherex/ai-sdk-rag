'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Transaction = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  amount: number;
  balance: number;
  type: string;
  description: string | null;
  createdAt: string;
};

const TYPE_LABELS: Record<string, { label: string; className: string }> = {
  grant:        { label: 'Grant',        className: 'border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400' },
  usage:        { label: 'Usage',        className: 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400' },
  refund:       { label: 'Refund',       className: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400' },
  signup_bonus: { label: 'Signup Bonus', className: 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-400' },
};

export default function AdminCreditsPage() {
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{ transactions: Transaction[] }>({
    queryKey: ['admin', 'transactions', { type: typeFilter, page }],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (typeFilter !== 'all') params.set('type', typeFilter);
      const res = await fetch(`/api/admin/credits/transactions?${params}`);
      if (!res.ok) throw new Error('Failed to fetch transactions');
      return res.json();
    },
  });

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const transactions = data?.transactions ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Credit Transactions</h1>
        <p className="text-sm text-muted-foreground">
          Full history of all credit activity
        </p>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Filter by type:</span>
        <Select
          value={typeFilter}
          onValueChange={(val) => {
            setTypeFilter(val);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="grant">Grant</SelectItem>
            <SelectItem value="usage">Usage</SelectItem>
            <SelectItem value="refund">Refund</SelectItem>
            <SelectItem value="signup_bonus">Signup Bonus</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-semibold text-foreground">Date</TableHead>
              <TableHead className="font-semibold text-foreground">User</TableHead>
              <TableHead className="font-semibold text-foreground">Type</TableHead>
              <TableHead className="text-right font-semibold text-foreground">Amount</TableHead>
              <TableHead className="text-right font-semibold text-foreground">Balance After</TableHead>
              <TableHead className="font-semibold text-foreground">Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : !transactions.length ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No transactions found
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((tx) => {
                const typeInfo = TYPE_LABELS[tx.type] ?? {
                  label: tx.type,
                  className: 'border-border bg-muted text-muted-foreground',
                };
                return (
                  <TableRow key={tx.id} className="hover:bg-muted/30">
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDateTime(tx.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="font-medium">{tx.userName ?? '—'}</span>
                        {tx.userEmail && (
                          <span className="ml-1.5 text-muted-foreground">
                            {tx.userEmail}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${typeInfo.className}`}>
                        {typeInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium">
                      <span className={tx.amount > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        {tx.amount > 0 ? '+' : ''}
                        {tx.amount}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">
                      {tx.balance}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {tx.description ?? '—'}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">Page {page}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={transactions.length < 30}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
