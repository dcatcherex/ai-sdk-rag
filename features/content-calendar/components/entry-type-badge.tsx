import { cn } from '@/lib/utils';
import type { CalendarEntryContentType } from '../types';

const typeConfig: Record<CalendarEntryContentType, { label: string; className: string }> = {
  blog_post: { label: 'Blog Post', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  newsletter: { label: 'Newsletter', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  social: { label: 'Social', className: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300' },
  email: { label: 'Email', className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  ad_copy: { label: 'Ad Copy', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  other: { label: 'Other', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
};

type Props = {
  contentType: CalendarEntryContentType;
  className?: string;
};

export function EntryTypeBadge({ contentType, className }: Props) {
  const config = typeConfig[contentType] ?? typeConfig.other;
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
