'use client';

import { useState } from 'react';
import { BarChart2Icon, SearchIcon, FileTextIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useContentPieces } from '@/features/long-form/hooks/use-content-pieces';
import { AnalyticsDashboard } from '@/features/analytics/components/analytics-dashboard';

export function HubMeasureTab() {
  const [activeId, setActiveId] = useState('');
  const [inputVal, setInputVal] = useState('');
  const { data: pieces = [] } = useContentPieces();

  const handleLookup = () => {
    if (inputVal.trim()) setActiveId(inputVal.trim());
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div>
        <h2 className="text-base font-semibold">Performance Analytics</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Track views, clicks, and engagement across your published content.</p>
      </div>

      {/* Content piece selector from library */}
      {pieces.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Your content pieces</p>
          <div className="space-y-1.5">
            {pieces.slice(0, 8).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setActiveId(p.id); setInputVal(p.id); }}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                  activeId === p.id
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-black/5 dark:border-border bg-muted/20 hover:bg-muted/40'
                }`}
              >
                <FileTextIcon className="size-3.5 text-muted-foreground shrink-0" />
                <span className="truncate text-sm flex-1">{p.title}</span>
                <Badge variant="outline" className="text-[10px] capitalize shrink-0">{p.status}</Badge>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Manual ID lookup */}
      <div className="rounded-xl border border-black/5 dark:border-border bg-muted/20 p-4">
        <p className="mb-2 text-sm font-medium">Look up by content piece ID</p>
        <div className="flex gap-2">
          <Input
            placeholder="Paste content piece ID…"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleLookup(); }}
            className="h-8 text-sm"
          />
          <Button size="sm" onClick={handleLookup} className="gap-1.5 h-8">
            <SearchIcon className="size-3.5" />
            Load
          </Button>
        </div>
      </div>

      {activeId ? (
        <div className="rounded-xl border border-black/5 dark:border-border bg-card p-4">
          <AnalyticsDashboard
            contentPieceId={activeId}
            contentTitle={pieces.find((p) => p.id === activeId)?.title}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <BarChart2Icon className="mx-auto size-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Select a content piece above to view its analytics.</p>
        </div>
      )}
    </div>
  );
}
