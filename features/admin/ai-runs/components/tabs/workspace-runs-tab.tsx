'use client';

import { BotIcon, EyeIcon, ImageIcon, SearchIcon, SparklesIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, Pagination, StatusBadge, SummaryCard, WorkspaceKindLabel } from '../shared';
import type { AdminWorkspaceAiRunsResponse } from '../../types';

type Props = {
  data: AdminWorkspaceAiRunsResponse | undefined;
  isLoading: boolean;
  isFetching: boolean;
  search: string;
  status: string;
  route: string;
  kind: string;
  modelId: string;
  page: number;
  onSearchChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onRouteChange: (v: string) => void;
  onKindChange: (v: string) => void;
  onModelIdChange: (v: string) => void;
  onPageChange: (page: number) => void;
  onViewRun: (id: string) => void;
};

export function WorkspaceRunsTab({
  data, isLoading, isFetching,
  search, status, route, kind, modelId, page,
  onSearchChange, onStatusChange, onRouteChange, onKindChange, onModelIdChange,
  onPageChange, onViewRun,
}: Props) {
  const kindOptions = data?.summary.byKind ?? [];
  const modelOptions = data?.summary.byModel ?? [];

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
          <CardTitle className="text-base">Workspace AI Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search user, kind, entity..."
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

          <Select value={route} onValueChange={onRouteChange}>
            <SelectTrigger><SelectValue placeholder="Route" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All routes</SelectItem>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="image">Image</SelectItem>
            </SelectContent>
          </Select>

          <Select value={kind} onValueChange={onKindChange}>
            <SelectTrigger><SelectValue placeholder="Kind" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All kinds</SelectItem>
              {kindOptions.map((opt) => (
                <SelectItem key={opt.key} value={opt.key}>{opt.key}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={modelId} onValueChange={onModelIdChange}>
            <SelectTrigger><SelectValue placeholder="Model" /></SelectTrigger>
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
              <TableHead>Kind</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Model</TableHead>
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
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">No workspace AI runs found</TableCell>
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
                      <SparklesIcon className="size-3.5" />
                      <WorkspaceKindLabel kind={run.kind} />
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="space-y-1">
                      <div className="capitalize">{run.entityType}</div>
                      <div className="text-xs text-muted-foreground">{run.entityId || '—'}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="inline-flex items-center gap-1.5 text-sm capitalize">
                      {run.route === 'image' ? <ImageIcon className="size-3.5" /> : <BotIcon className="size-3.5" />}
                      {run.route}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{run.modelId || '—'}</TableCell>
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
