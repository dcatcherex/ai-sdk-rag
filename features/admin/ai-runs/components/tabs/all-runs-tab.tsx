'use client';

import { SearchIcon, EyeIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, Pagination, STATUS_BADGE_VARIANT, SummaryCard } from '../shared';
import type { AdminUnifiedRunsResponse } from '../../types';

type Props = {
  data: AdminUnifiedRunsResponse | undefined;
  isLoading: boolean;
  isFetching: boolean;
  search: string;
  status: string;
  runtime: string;
  page: number;
  onSearchChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onRuntimeChange: (v: string) => void;
  onPageChange: (page: number) => void;
  onViewRun: (runtime: string, id: string) => void;
};

export function AllRunsTab({
  data, isLoading, isFetching,
  search, status, runtime, page,
  onSearchChange, onStatusChange, onRuntimeChange, onPageChange,
  onViewRun,
}: Props) {
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
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search user, model, tool, thread..."
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

          <Select value={runtime} onValueChange={onRuntimeChange}>
            <SelectTrigger><SelectValue placeholder="Runtime" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All runtimes</SelectItem>
              <SelectItem value="chat">Chat</SelectItem>
              <SelectItem value="workspace">Workspace AI</SelectItem>
              <SelectItem value="tool">Tool</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Runtime</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Route / Source</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : !data?.runs.length ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No AI runs found
                </TableCell>
              </TableRow>
            ) : (
              data.runs.map((run) => (
                <TableRow key={`${run.runtime}-${run.id}`} className="hover:bg-muted/30">
                  <TableCell className="min-w-40">
                    <div className="space-y-1">
                      <div className="font-medium capitalize">
                        {run.runtime === 'workspace' ? 'Workspace AI' : run.runtime}
                      </div>
                      <div className="text-xs text-muted-foreground">{run.title}</div>
                    </div>
                  </TableCell>
                  <TableCell className="min-w-52">
                    <div className="space-y-1">
                      <div className="font-medium">{run.userName || 'Unknown user'}</div>
                      <div className="text-xs text-muted-foreground">{run.userEmail || run.userId}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE_VARIANT[run.status]} className="capitalize">
                      {run.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="space-y-1">
                      <div>{run.modelOrTarget || '—'}</div>
                      <div className="text-xs text-muted-foreground">{run.subtitle || '—'}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{run.routeKind || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(run.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => onViewRun(run.runtime, run.id)}>
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
