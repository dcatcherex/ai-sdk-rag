'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

type SelectionListItem = {
  id: string;
  title: string;
  meta?: string;
  checked: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  expandedContent?: React.ReactNode;
};

type SelectionListSection = {
  id: string;
  label: string;
  items: SelectionListItem[];
};

type SelectionListProps = {
  emptyMessage: string;
  items?: SelectionListItem[];
  sections?: SelectionListSection[];
};

function renderItems(items: SelectionListItem[]) {
  return items.map((item) => (
    <div key={item.id} className="rounded px-2 py-1.5 hover:bg-muted/50">
      <div className="flex items-center gap-2">
        <Checkbox
          id={item.id}
          checked={item.checked}
          onCheckedChange={item.onToggle}
          className="shrink-0"
        />
        <label
          htmlFor={item.id}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-sm font-medium leading-none"
        >
          <span className="truncate">{item.title}</span>
          {item.meta ? (
            <span className={cn('shrink-0 text-xs font-normal text-muted-foreground')}>
              {item.meta}
            </span>
          ) : null}
        </label>
        {item.action ? <div className="shrink-0">{item.action}</div> : null}
      </div>
      {item.expandedContent ? <div className="mt-2">{item.expandedContent}</div> : null}
    </div>
  ));
}

export function SelectionList({ emptyMessage, items, sections }: SelectionListProps) {
  const normalizedSections = sections ?? [{ id: 'default', label: '', items: items ?? [] }];
  const visibleSections = normalizedSections.filter((section) => section.items.length > 0);

  if (visibleSections.length === 0) {
    return <p className="text-xs italic text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="max-h-96 space-y-0.5 overflow-y-auto rounded-md border border-black/5 p-1 dark:border-border">
      {visibleSections.map((section, index) => (
        <div key={section.id} className={cn(index > 0 && 'mt-2 border-t border-black/5 pt-2 dark:border-border')}>
          {section.label ? (
            <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {section.label}
            </div>
          ) : null}
          <div className="space-y-0.5">
            {renderItems(section.items)}
          </div>
        </div>
      ))}
    </div>
  );
}
