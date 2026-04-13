'use client';

import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type CountTabItem = {
  value: string;
  label: string;
  count?: number;
};

type CountTabsListProps = {
  items: CountTabItem[];
  className?: string;
};

export function CountTabsList({ items, className }: CountTabsListProps) {
  return (
    <TabsList className={cn('mb-4', className)}>
      {items.map((item) => (
        <TabsTrigger key={item.value} value={item.value}>
          {item.label}
          {typeof item.count === 'number' ? ` (${item.count})` : ''}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
