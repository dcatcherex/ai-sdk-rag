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

const TYPE_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  grant: { label: 'Grant', variant: 'default' },
  usage: { label: 'Usage', variant: 'secondary' },
  refund: { label: 'Refund', variant: 'outline' },
  signup_bonus: { label: 'Signup Bonus', variant: 'default' },
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
      <div className="overflow-x-auto rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Balance After</TableHead>
              <TableHead>Description</TableHead>
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
                  variant: 'outline' as const,
                };
                return (
                  <TableRow key={tx.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDateTime(tx.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="font-medium">{tx.userName ?? '—'}</span>
                        <span className="ml-1.5 text-muted-foreground">
                          {tx.userEmail}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={typeInfo.variant} className="text-xs">
                        {typeInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      <span
                        className={tx.amount > 0 ? 'text-green-600' : 'text-red-500'}
                      >
                        {tx.amount > 0 ? '+' : ''}
                        {tx.amount}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
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
