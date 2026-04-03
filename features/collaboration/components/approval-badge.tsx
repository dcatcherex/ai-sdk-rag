'use client';

import { Badge } from '@/components/ui/badge';
import type { ApprovalStatus } from '../types';

type Props = {
  status: ApprovalStatus;
};

const STATUS_CONFIG: Record<
  ApprovalStatus,
  { label: string; className: string }
> = {
  pending: {
    label: 'Pending',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  },
  approved: {
    label: 'Approved',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
  },
  changes_requested: {
    label: 'Changes Requested',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  },
};

export function ApprovalBadge({ status }: Props) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge
      variant="outline"
      className={`text-[10px] px-1.5 py-0 font-medium ${config.className}`}
    >
      {config.label}
    </Badge>
  );
}
