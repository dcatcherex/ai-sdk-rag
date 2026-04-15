'use client';

import { BotIcon, EyeIcon, ImageIcon, SearchIcon, WrenchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, Pagination, StatusBadge, SummaryCard } from '../shared';
import type { AdminChatRunsResponse } from '../../types';

type Props = {
  data: AdminChatRunsResponse | undefined;
  isLoading: boolean;
  isFetching: boolean;
  search: string;
  status: string;
  routeKind: string;
  resolvedModelId: string;
  page: number;
  onSearchChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onRouteKindChange: (v: string) => void;
  onResolvedModelIdChange: (v: string) => void;
  onPageChange: (page: number) => void;
  onViewRun: (id: string) => void;
};

export function ChatRunsTab({
  data, isLoading, isFetching,
  search, status, routeKind, resolvedModelId, page,
  onSearchChange, onStatusChange, onRouteKindChange, onResolvedModelIdChange,
  onPageChange, onViewRun,
}: Props) {
  const modelOptions = data?.summary.byResolvedModel ?? [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <SummaryCard title="Total runs" value={data?.summary.totalRuns ?? 0} />
        <SummaryCard title="Successful" value={data?.summary.successCount ?? 0} />
        <SummaryCard title="Errors" value={data?.summary.errorCount ?? 0} />
        <SummaryCard title="Pending" value={data?.summary.pendingCount ?? 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chat Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search user, email, thread..."
              className="pl-9"
            />
          </div>

          <Select value={status} onValueChange={onStatusChange}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>

          <Select value={routeKind} onValueChange={onRouteKindChange}>
            <SelectTrigger><SelectValue placeholder="Route kind" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All routes</SelectItem>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="image">Image</SelectItem>
            </SelectContent>
          </Select>

          <Select value={resolvedModelId} onValueChange={onResolvedModelIdChange}>
            <SelectTrigger><SelectValue placeholder="Resolved model" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All models</SelectItem>
              {modelOptions.map((opt) => (
                <SelectItem key={opt.key} value={opt.key}>{opt.key}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>User</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Tools</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Loading...</TableCell>
              </TableRow>
            ) : !data?.runs.length ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">No chat runs found</TableCell>
              </TableRow>
            ) : (
              data.runs.map((run) => (
                <TableRow key={run.id} className="hover:bg-muted/30">
                  <TableCell className="min-w-52">
                    <div className="space-y-1">
                      <div className="font-medium">{run.userName || 'Unknown user'}</div>
                      <div className="text-xs text-muted-foreground">{run.userEmail || run.userId}</div>
                      <div className="text-xs text-muted-foreground">Thread {run.threadId}</div>
                    </div>
                  </TableCell>
                  <TableCell><StatusBadge status={run.status} /></TableCell>
                  <TableCell>
                    <div className="inline-flex items-center gap-1.5 text-sm capitalize">
                      {run.routeKind === 'image' ? <ImageIcon className="size-3.5" /> : <BotIcon className="size-3.5" />}
                      {run.routeKind}
                    </div>
                  </TableCell>
                  <TableCell className="min-w-56">
                    <div className="space-y-1">
                      <div className="text-sm">{run.resolvedModelId || '—'}</div>
                      <div className="text-xs capitalize text-muted-foreground">{run.routingMode || '—'}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {run.usedTools ? (
                      <div className="inline-flex items-center gap-1.5 text-sm">
                        <WrenchIcon className="size-3.5" />
                        {run.toolCallCount}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm">
                      <div>{run.totalTokens ?? 0} tokens</div>
                      <div className="text-xs text-muted-foreground">{run.creditCost ?? 0} credits</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(run.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => onViewRun(run.id)}>
                      <EyeIcon className="mr-1.5 size-3.5" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination
        page={page}
        totalPages={data?.totalPages ?? 0}
        isFetching={isFetching}
        onPageChange={onPageChange}
      />
    </div>
  );
}
