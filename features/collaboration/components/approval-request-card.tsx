'use client';

import { CheckIcon, XIcon, RefreshCwIcon, CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApprovalBadge } from './approval-badge';
import { useResolveApproval } from '../hooks/use-collaboration';
import type { ApprovalRequest } from '../types';

type Props = {
  request: ApprovalRequest;
  isReviewer?: boolean;
};

function formatDate(date: Date | string | null | undefined) {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ApprovalRequestCard({ request, isReviewer = false }: Props) {
  const resolveMutation = useResolveApproval();

  const handleResolve = (status: 'approved' | 'rejected' | 'changes_requested') => {
    resolveMutation.mutate({ id: request.id, status });
  };

  return (
    <div className="rounded-lg border border-black/5 dark:border-border bg-muted/30 px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">
            {request.contentPieceTitle ?? 'Untitled content'}
          </p>
          {request.requesterName && (
            <p className="text-xs text-muted-foreground">
              Submitted by {request.requesterName}
            </p>
          )}
          {request.assigneeName && (
            <p className="text-xs text-muted-foreground">
              Assigned to {request.assigneeName}
            </p>
          )}
        </div>
        <ApprovalBadge status={request.status} />
      </div>

      {request.dueAt && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarIcon className="size-3" />
          <span>Due {formatDate(request.dueAt)}</span>
        </div>
      )}

      {request.resolutionNote && (
        <p className="text-xs text-muted-foreground border-l-2 border-muted pl-2">
          {request.resolutionNote}
        </p>
      )}

      {request.resolvedAt && (
        <p className="text-xs text-muted-foreground">
          Resolved {formatDate(request.resolvedAt)}
        </p>
      )}

      {isReviewer && request.status === 'pending' && (
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
            onClick={() => handleResolve('approved')}
            disabled={resolveMutation.isPending}
          >
            <CheckIcon className="size-3 mr-1" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs text-orange-700 border-orange-200 hover:bg-orange-50"
            onClick={() => handleResolve('changes_requested')}
            disabled={resolveMutation.isPending}
          >
            <RefreshCwIcon className="size-3 mr-1" />
            Request Changes
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs text-destructive border-red-200 hover:bg-red-50"
            onClick={() => handleResolve('rejected')}
            disabled={resolveMutation.isPending}
          >
            <XIcon className="size-3 mr-1" />
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}
