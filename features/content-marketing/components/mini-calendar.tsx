'use client';

import { useState, useMemo } from 'react';
import type { SocialPostRecord } from '../types';
import { PlatformBadge } from './platform-badge';

export function MiniCalendar({ posts }: { posts: SocialPostRecord[] }) {
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDow = viewDate.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const postsByDay = useMemo(() => {
    const map: Record<string, SocialPostRecord[]> = {};
    for (const post of posts) {
      if (!post.scheduledAt) continue;
      const d = new Date(post.scheduledAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map[key]) map[key] = [];
      map[key].push(post);
    }
    return map;
  }, [posts]);

  const monthName = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const prev = () => setViewDate(new Date(year, month - 1, 1));
  const next = () => setViewDate(new Date(year, month + 1, 1));

  const cells: Array<{ key: string | null; day: number | null }> = [
    ...Array.from({ length: firstDow }, () => ({ key: null, day: null })),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { key, day };
    }),
  ];

  const selectedPosts = selectedDay ? (postsByDay[selectedDay] ?? []) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={prev} className="rounded p-1 hover:bg-muted text-muted-foreground">‹</button>
        <p className="text-sm font-semibold">{monthName}</p>
        <button type="button" onClick={next} className="rounded p-1 hover:bg-muted text-muted-foreground">›</button>
      </div>

      <div className="grid grid-cols-7 text-center">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="py-1 text-[11px] font-medium text-muted-foreground">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px text-center">
        {cells.map((cell, i) => {
          if (!cell.key || !cell.day) return <div key={`empty-${i}`} />;
          const hasPosts = !!postsByDay[cell.key];
          const isToday = cell.key === todayKey;
          const isSelected = cell.key === selectedDay;

          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => setSelectedDay(isSelected ? null : cell.key)}
              className={`relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors ${
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : isToday
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'hover:bg-muted'
              }`}
            >
              {cell.day}
              {hasPosts && (
                <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full ${isSelected ? 'bg-primary-foreground' : 'bg-primary'}`} />
              )}
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <div className="mt-2 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {new Date(selectedDay + 'T00:00:00').toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          {selectedPosts.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No scheduled posts</p>
          ) : (
            <div className="space-y-2">
              {selectedPosts.map((post) => (
                <div key={post.id} className="rounded-lg border p-3">
                  <p className="text-xs line-clamp-2 text-foreground">{post.caption}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {post.platforms.map((p) => <PlatformBadge key={p} platform={p} />)}
                    {post.scheduledAt && (
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(post.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
