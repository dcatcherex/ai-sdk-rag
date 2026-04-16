'use client';

import { CheckCircleIcon, XCircleIcon, SendIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { AdminInviteStatus, RunEntry } from '../types';

export function UserApprovalBadge({ approved }: { approved: boolean }) {
  if (approved) {
    return (
      <Badge variant="outline" className="gap-1 border-green-300 text-green-700">
        <CheckCircleIcon className="size-3" />
        Approved
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1 text-amber-700">
      <XCircleIcon className="size-3" />
      Pending
    </Badge>
  );
}

export function RunStatusBadge({ status }: { status: string }) {
  if (status === 'success') {
    return (
      <Badge variant="outline" className="border-green-300 text-green-700">
        Success
      </Badge>
    );
  }
  if (status === 'error') {
    return <Badge variant="destructive">Error</Badge>;
  }
  return <Badge variant="secondary" className="capitalize">{status}</Badge>;
}

export function RunTypeBadge({ type }: { type: RunEntry['type'] }) {
  const map = {
    chat: 'bg-indigo-100 text-indigo-700',
    tool: 'bg-amber-100 text-amber-700',
    workspace: 'bg-violet-100 text-violet-700',
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${map[type]}`}>
      {type}
    </span>
  );
}

export function InviteStatusBadge({ status }: { status: AdminInviteStatus }) {
  if (status === 'accepted') {
    return (
      <Badge variant="outline" className="gap-1 border-green-300 text-green-700">
        <CheckCircleIcon className="size-3" />
        Accepted
      </Badge>
    );
  }
  if (status === 'expired') {
    return <Badge variant="secondary">Expired</Badge>;
  }
  if (status === 'cancelled') {
    return (
      <Badge variant="outline" className="gap-1 border-zinc-300 text-zinc-700">
        <XCircleIcon className="size-3" />
        Cancelled
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-blue-300 text-blue-700">
      <SendIcon className="size-3" />
      Invited
    </Badge>
  );
}

export function BalanceBadge({ balance }: { balance: number }) {
  return (
    <Badge
      variant={balance <= 0 ? 'destructive' : balance <= 10 ? 'secondary' : 'outline'}
      className="font-mono"
    >
      {balance}
    </Badge>
  );
}
