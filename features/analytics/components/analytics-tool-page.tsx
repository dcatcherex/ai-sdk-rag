'use client';

import { useState } from 'react';
import { BarChart2Icon, SearchIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AnalyticsDashboard } from './analytics-dashboard';
import type { ToolPageProps } from '@/features/tools/registry/page-loaders';

export function AnalyticsToolPage({ manifest }: ToolPageProps) {
  const [contentPieceId, setContentPieceId] = useState('');
  const [activeId, setActiveId] = useState('');
  const [inputVal, setInputVal] = useState('');

  const handleLookup = () => {
    if (inputVal.trim()) {
      setActiveId(inputVal.trim());
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-black/5 dark:border-border px-6 py-5">
        <div className="flex items-center gap-2">
          <BarChart2Icon className="size-5 text-primary" />
          <h1 className="text-xl font-semibold">{manifest.title}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{manifest.description}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Content piece lookup */}
        <div className="rounded-xl border border-black/5 dark:border-border bg-muted/20 p-4">
          <p className="mb-2 text-sm font-medium">Look up content piece metrics</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Enter a content piece ID to view or log performance metrics. You can find the ID in the Long-form Content tool.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="Content piece ID…"
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
            <AnalyticsDashboard contentPieceId={activeId} />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <BarChart2Icon className="mx-auto size-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">
              Enter a content piece ID above to view analytics
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Or ask the AI assistant to track metrics for you
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
