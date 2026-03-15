'use client';

import { Button } from '@/components/ui/button';
import type { TrendItem } from '../types';

type Props = {
  trend: TrendItem;
  onUse: () => void;
};

export function TrendCard({ trend, onUse }: Props) {
  const platformColor =
    trend.platform === 'tiktok'
      ? 'bg-black text-white dark:bg-zinc-800'
      : 'bg-gradient-to-br from-pink-500 to-purple-600 text-white';

  return (
    <div className="flex flex-col rounded-xl border bg-card p-4 gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${platformColor}`}>
              {trend.platform}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground capitalize">
              {trend.industry}
            </span>
            <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] text-muted-foreground capitalize">
              {trend.contentType}
            </span>
          </div>
          <h3 className="mt-2 text-sm font-semibold text-foreground line-clamp-1">{trend.title}</h3>
        </div>
        {trend.growthPercent !== undefined && (
          <div className="shrink-0 text-right">
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">+{trend.growthPercent}%</p>
            <p className="text-[10px] text-muted-foreground">7d growth</p>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{trend.description}</p>

      {trend.postCount !== undefined && (
        <p className="text-[11px] text-muted-foreground">
          {trend.postCount >= 1_000_000
            ? `${(trend.postCount / 1_000_000).toFixed(1)}M`
            : trend.postCount >= 1_000
            ? `${(trend.postCount / 1_000).toFixed(0)}K`
            : trend.postCount}{' '}
          {trend.platform === 'tiktok' ? 'views' : 'posts'}
        </p>
      )}

      {trend.contentIdeas.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Content ideas</p>
          <ul className="space-y-1">
            {trend.contentIdeas.slice(0, 2).map((idea, i) => (
              <li key={i} className="flex gap-1.5 text-xs text-foreground">
                <span className="text-primary mt-0.5 shrink-0">•</span>
                <span className="line-clamp-2">{idea}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {trend.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {trend.hashtags.slice(0, 4).map((tag) => (
            <span key={tag} className="rounded bg-primary/5 px-1.5 py-0.5 text-[10px] text-primary font-medium">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center gap-2 pt-1">
        <Button size="sm" className="flex-1 h-7 text-xs" onClick={onUse}>
          Create post from this
        </Button>
        {trend.exampleUrl && (
          <a
            href={trend.exampleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-7 items-center rounded-md border px-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View
          </a>
        )}
      </div>
    </div>
  );
}
