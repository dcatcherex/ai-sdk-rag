'use client';

import {
  DndContext,
  closestCorners,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useUpdateEntryStatus } from '../hooks/use-calendar';
import { StatusBadge } from './status-badge';
import { EntryTypeBadge } from './entry-type-badge';
import type { CalendarEntry, CalendarEntryStatus } from '../types';

const COLUMN_ORDER: CalendarEntryStatus[] = [
  'idea', 'briefed', 'drafting', 'review', 'approved', 'scheduled', 'published', 'repurposed',
];

const COLUMN_LABELS: Record<CalendarEntryStatus, string> = {
  idea: 'Idea',
  briefed: 'Briefed',
  drafting: 'Drafting',
  review: 'Review',
  approved: 'Approved',
  scheduled: 'Scheduled',
  published: 'Published',
  repurposed: 'Repurposed',
};

type CardProps = {
  entry: CalendarEntry;
  onEntryClick: (entry: CalendarEntry) => void;
};

function KanbanCard({ entry, onEntryClick }: CardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
    data: { status: entry.status },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="rounded-md border bg-card p-2 shadow-sm cursor-grab active:cursor-grabbing select-none"
      onClick={() => onEntryClick(entry)}
    >
      <p className="text-sm font-medium line-clamp-2 mb-1">{entry.title}</p>
      <div className="flex flex-wrap gap-1">
        <EntryTypeBadge contentType={entry.contentType} />
        {entry.channel && (
          <span className="inline-flex items-center rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">
            {entry.channel}
          </span>
        )}
      </div>
      {entry.plannedDate && (
        <p className="mt-1 text-[10px] text-muted-foreground">{entry.plannedDate}</p>
      )}
    </div>
  );
}

type ColumnProps = {
  status: CalendarEntryStatus;
  entries: CalendarEntry[];
  onEntryClick: (entry: CalendarEntry) => void;
};

function KanbanColumn({ status, entries, onEntryClick }: ColumnProps) {
  return (
    <div className="flex w-52 shrink-0 flex-col gap-2">
      <div className="flex items-center justify-between">
        <StatusBadge status={status} />
        <span className="text-xs text-muted-foreground">{entries.length}</span>
      </div>
      <div className="min-h-[120px] rounded-lg bg-muted/40 p-2">
        <SortableContext
          items={entries.map((e) => e.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {entries.map((entry) => (
              <KanbanCard key={entry.id} entry={entry} onEntryClick={onEntryClick} />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

type Props = {
  entries: Record<CalendarEntryStatus, CalendarEntry[]>;
  onEntryClick: (entry: CalendarEntry) => void;
};

export function KanbanBoard({ entries, onEntryClick }: Props) {
  const updateStatus = useUpdateEntryStatus();

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Find which column the card landed in
    const overStatus = COLUMN_ORDER.find((status) => {
      const col = entries[status];
      return col.some((e) => e.id === over.id) || status === over.id;
    });

    if (!overStatus) return;

    const activeStatus = COLUMN_ORDER.find((status) =>
      entries[status].some((e) => e.id === active.id),
    );

    if (!activeStatus || activeStatus === overStatus) return;

    updateStatus.mutate({ id: String(active.id), status: overStatus });
  };

  return (
    <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMN_ORDER.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            entries={entries[status] ?? []}
            onEntryClick={onEntryClick}
          />
        ))}
      </div>
    </DndContext>
  );
}
