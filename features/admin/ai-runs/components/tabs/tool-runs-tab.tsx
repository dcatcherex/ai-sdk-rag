'use client';

import { EyeIcon, SearchIcon, WrenchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, Pagination, StatusBadge, SummaryCard } from '../shared';
import type { AdminToolRunsResponse } from '../../types';

type Props = {
  data: AdminToolRunsResponse | undefined;
  isLoading: boolean;
  isFetching: boolean;
  search: string;
  status: string;
  slug: string;
  source: string;
  page: number;
  onSearchChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onSlugChange: (v: string) => void;
  onSourceChange: (v: string) => void;
  onPageChange: (page: number) => void;
  onViewRun: (id: string) => void;
};

export function ToolRunsTab({
  data, isLoading, isFetching,
  search, status, slug, source, page,
  onSearchChange, onStatusChange, onSlugChange, onSourceChange,
  onPageChange, onViewRun,
}: Props) {
  const slugOptions = data?.summary.byToolSlug ?? [];
  const sourceOptions = data?.summary.bySource ?? [];

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
          <CardTitle className="text-base">Tool Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search user, tool, thread..."
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

          <Select value={slug} onValueChange={onSlugChange}>
            <SelectTrigger><SelectValue placeholder="Tool" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tools</SelectItem>
              {slugOptions.map((opt) => (
                <SelectItem key={opt.key} value={opt.key}>{opt.key}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={source} onValueChange={onSourceChange}>
            <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {sourceOptions.map((opt) => (
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
              <TableHead>Tool</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Thread</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Loading...</TableCell>
              </TableRow>
            ) : !data?.runs.length ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No tool runs found</TableCell>
              </TableRow>
            ) : (
              data.runs.map((run) => (
                <TableRow key={run.id} className="hover:bg-muted/30">
                  <TableCell className="min-w-52">
                    <div className="space-y-1">
                      <div className="font-medium">{run.userName || 'Unknown user'}</div>
                      <div className="text-xs text-muted-foreground">{run.userEmail || run.userId}</div>
                    </div>
                  </TableCell>
                  <TableCell><StatusBadge status={run.status} /></TableCell>
                  <TableCell>
                    <div className="inline-flex items-center gap-1.5 text-sm">
                      <WrenchIcon className="size-3.5" />
                      {run.toolSlug}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{run.source}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{run.threadId || '—'}</TableCell>
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
