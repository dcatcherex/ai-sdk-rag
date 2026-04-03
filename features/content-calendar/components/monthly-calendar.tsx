'use client';

import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CalendarEntry } from '../types';

const STATUS_COLORS: Record<string, string> = {
  idea: 'bg-gray-200 text-gray-800',
  briefed: 'bg-blue-200 text-blue-800',
  drafting: 'bg-amber-200 text-amber-800',
  review: 'bg-orange-200 text-orange-800',
  approved: 'bg-green-200 text-green-800',
  scheduled: 'bg-purple-200 text-purple-800',
  published: 'bg-emerald-200 text-emerald-800',
  repurposed: 'bg-indigo-200 text-indigo-800',
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toIsoDate(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

type Props = {
  year: number;
  month: number;
  entries: CalendarEntry[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onEntryClick: (entry: CalendarEntry) => void;
  onAddEntry: (date: string) => void;
};

export function MonthlyCalendar({
  year,
  month,
  entries,
  onPrevMonth,
  onNextMonth,
  onEntryClick,
  onAddEntry,
}: Props) {
  // Build day grid
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();

  // Group entries by date
  const byDate = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    const key = entry.plannedDate;
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(entry);
  }

  // Build grid cells: leading blanks + days
  const cells: Array<{ day: number | null; dateStr: string | null }> = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push({ day: null, dateStr: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, dateStr: toIsoDate(year, month, d) });
  }

  const today = new Date();
  const todayStr = toIsoDate(today.getFullYear(), today.getMonth() + 1, today.getDate());

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={onPrevMonth}>
          <ChevronLeftIcon className="size-4" />
        </Button>
        <h2 className="font-semibold">
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <Button variant="ghost" size="icon" onClick={onNextMonth}>
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 text-center">
        {DAY_LABELS.map((d) => (
          <div key={d} className="py-1 text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 border-l border-t">
        {cells.map((cell, idx) => {
          const dayEntries = cell.dateStr ? (byDate.get(cell.dateStr) ?? []) : [];
          const isToday = cell.dateStr === todayStr;
          return (
            <div
              key={idx}
              className={cn(
                'min-h-[80px] border-b border-r p-1',
                !cell.day && 'bg-muted/30',
              )}
            >
              {cell.day !== null && cell.dateStr !== null ? (
                <>
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'flex size-6 items-center justify-center rounded-full text-xs',
                        isToday && 'bg-primary text-primary-foreground font-semibold',
                      )}
                    >
                      {cell.day}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-5 opacity-0 hover:opacity-100 group-hover:opacity-100"
                      onClick={() => onAddEntry(cell.dateStr!)}
                      tabIndex={-1}
                    >
                      <PlusIcon className="size-3" />
                    </Button>
                  </div>
                  <div className="mt-0.5 space-y-0.5">
                    {dayEntries.slice(0, 3).map((e) => (
                      <button
                        key={e.id}
                        className={cn(
                          'w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium leading-tight',
                          STATUS_COLORS[e.status] ?? STATUS_COLORS['idea'],
                        )}
                        onClick={() => onEntryClick(e)}
                      >
                        {e.title}
                      </button>
                    ))}
                    {dayEntries.length > 3 && (
                      <span className="block text-[10px] text-muted-foreground px-1">
                        +{dayEntries.length - 3} more
                      </span>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
