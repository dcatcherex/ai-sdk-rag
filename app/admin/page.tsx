'use client';

import { useQuery } from '@tanstack/react-query';
import { CoinsIcon, UsersIcon, ArrowRightLeftIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

type AdminUser = {
  id: string;
  name: string;
  email: string;
  balance: number;
  createdAt: string;
};

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

export default function AdminDashboard() {
  const { data: usersData } = useQuery<{ users: AdminUser[]; total: number }>({
    queryKey: ['admin', 'users', { limit: 5 }],
    queryFn: async () => {
      const res = await fetch('/api/admin/users?limit=5');
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
  });

  const { data: txData } = useQuery<{ transactions: Transaction[] }>({
    queryKey: ['admin', 'transactions', { limit: 5 }],
    queryFn: async () => {
      const res = await fetch('/api/admin/credits/transactions?limit=5');
      if (!res.ok) throw new Error('Failed to fetch transactions');
      return res.json();
    },
  });

  const totalUsers = usersData?.total ?? 0;
  const totalCreditsInCirculation =
    usersData?.users?.reduce((sum, u) => sum + u.balance, 0) ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of users and credit system
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Users
            </CardTitle>
            <UsersIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Credits in Circulation
            </CardTitle>
            <CoinsIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCreditsInCirculation}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent Transactions
            </CardTitle>
            <ArrowRightLeftIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {txData?.transactions?.length ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent users */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Users</CardTitle>
          <Link
            href="/admin/users"
            className="text-xs font-medium text-primary hover:underline"
          >
            View all →
          </Link>
        </CardHeader>
        <CardContent>
          {usersData?.users?.length ? (
            <div className="space-y-3">
              {usersData.users.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <span className="font-medium">{u.name}</span>
                    <span className="ml-2 truncate text-muted-foreground">{u.email}</span>
                  </div>
                  <span className="shrink-0 font-mono text-xs">{u.balance} credits</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No users yet</p>
          )}
        </CardContent>
      </Card>

      {/* Recent transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Transactions</CardTitle>
          <Link
            href="/admin/credits"
            className="text-xs font-medium text-primary hover:underline"
          >
            View all →
          </Link>
        </CardHeader>
        <CardContent>
          {txData?.transactions?.length ? (
            <div className="space-y-3">
              {txData.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        tx.amount > 0 ? 'text-green-600' : 'text-red-500'
                      }
                    >
                      {tx.amount > 0 ? '+' : ''}
                      {tx.amount}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {tx.userEmail ?? tx.userId}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{tx.type}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No transactions yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
