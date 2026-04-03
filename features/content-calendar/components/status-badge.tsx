import { cn } from '@/lib/utils';
import type { CalendarEntryStatus } from '../types';

const statusConfig: Record<CalendarEntryStatus, { label: string; className: string }> = {
  idea: { label: 'Idea', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  briefed: { label: 'Briefed', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  drafting: { label: 'Drafting', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  review: { label: 'Review', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  scheduled: { label: 'Scheduled', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  published: { label: 'Published', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  repurposed: { label: 'Repurposed', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
};

type Props = {
  status: CalendarEntryStatus;
  className?: string;
};

export function StatusBadge({ status, className }: Props) {
  const config = statusConfig[status] ?? statusConfig.idea;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
