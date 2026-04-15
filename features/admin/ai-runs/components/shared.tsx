import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AdminRunStatus } from '../types';

export const STATUS_BADGE_VARIANT: Record<AdminRunStatus, 'secondary' | 'destructive' | 'outline'> = {
  success: 'secondary',
  error: 'destructive',
  pending: 'outline',
};

export function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function StatusBadge({ status }: { status: AdminRunStatus }) {
  return (
    <Badge variant={STATUS_BADGE_VARIANT[status]} className="capitalize">
      {status}
    </Badge>
  );
}

export function SummaryCard({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

export function JsonBlock({ value }: { value: Record<string, unknown> | null }) {
  if (!value) {
    return (
      <div className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
        No data
      </div>
    );
  }
  return (
    <pre className="overflow-x-auto rounded-lg border bg-muted/30 p-3 text-xs leading-5">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function WorkspaceKindLabel({ kind }: { kind: string }) {
  return (
    <span>
      {kind
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')}
    </span>
  );
}

export function TokenValue({ value }: { value: number | null }) {
  return <span>{typeof value === 'number' ? value : '—'}</span>;
}

export function ErrorCard({ message }: { message: string }) {
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-destructive">Error</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-destructive">{message}</CardContent>
    </Card>
  );
}

export function Pagination({
  page,
  totalPages,
  isFetching,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  isFetching: boolean;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span className="text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || isFetching}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages || isFetching}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
