'use client';

import { useState } from 'react';
import { ArrowLeftIcon, SearchIcon, DatabaseIcon, LayersIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DocumentUpload } from '@/components/knowledge/document-upload';
import { DocumentList } from '@/components/knowledge/document-list';
import { DocumentDetail } from '@/components/knowledge/document-detail';
import { useDocumentStats, type DocumentItem } from '@/lib/hooks/use-documents';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const MODES = [
  { value: 'precise', label: 'Precise', className: 'border-blue-200 text-blue-700 dark:border-blue-700 dark:text-blue-300' },
  { value: 'optimized', label: 'Optimized', className: 'border-amber-200 text-amber-700 dark:border-amber-700 dark:text-amber-300' },
  { value: 'raw', label: 'Raw', className: 'border-zinc-200 text-zinc-500 dark:border-zinc-600 dark:text-zinc-400' },
];

export default function KnowledgePage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [modeFilter, setModeFilter] = useState<string | undefined>();
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { data: stats } = useDocumentStats();

  const handleSelectDocument = (doc: DocumentItem) => {
    setSelectedDocId(doc.id);
    setDetailOpen(true);
  };

  const handleCategoryFilter = (cat: string | undefined) => {
    setCategoryFilter(cat);
    if (cat) setGroupByCategory(false);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f2f0fa,_#e8e4f5_55%,_#dddaf0_100%)] dark:bg-[radial-gradient(circle_at_top,_#1c1a2e,_#181628_55%,_#141220_100%)]">
      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="icon" className="size-9">
                <ArrowLeftIcon className="size-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Knowledge Base</h1>
              <p className="text-xs text-muted-foreground">
                Upload and manage documents for AI-powered search
              </p>
            </div>
          </div>
          {stats && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <DatabaseIcon className="size-3.5" />
                {stats.totalDocuments} document{stats.totalDocuments !== 1 ? 's' : ''}
              </div>
              <div className="text-xs text-muted-foreground">
                {stats.totalChunks} chunk{stats.totalChunks !== 1 ? 's' : ''}
              </div>
            </div>
          )}
        </div>

        {/* Upload section */}
        <div className="mb-8 rounded-3xl border border-black/5 dark:border-border bg-card/70 dark:bg-card/80 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.25)] dark:shadow-[0_20px_60px_-40px_rgba(0,0,0,0.5)] backdrop-blur">
          <h2 className="mb-4 text-sm font-semibold">Upload Documents</h2>
          <DocumentUpload variant="full" />
        </div>

        {/* Toolbar: search + group by toggle */}
        <div className="mb-3 flex items-center gap-3">
          <div className="relative flex-1">
            <SearchIcon className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input
              className="pl-9 text-sm"
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant={groupByCategory ? 'default' : 'outline'}
            size="sm"
            className="h-9 gap-1.5 shrink-0"
            onClick={() => {
              setGroupByCategory((v) => !v);
              if (!groupByCategory) setCategoryFilter(undefined);
            }}
          >
            <LayersIcon className="size-3.5" />
            Group by category
          </Button>
        </div>

        {/* Filter row: categories + mode */}
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* Category filters */}
          {stats && stats.categories.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Category:</span>
              <Badge
                variant={!categoryFilter ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => handleCategoryFilter(undefined)}
              >
                All
              </Badge>
              {stats.categories.map((cat) => (
                <Badge
                  key={cat.name}
                  variant={categoryFilter === cat.name ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() =>
                    handleCategoryFilter(categoryFilter === cat.name ? undefined : cat.name)
                  }
                >
                  {cat.name}
                  <span className="ml-1 opacity-60">({cat.count})</span>
                </Badge>
              ))}
            </div>
          )}

          {/* Mode filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Mode:</span>
            <Badge
              variant={!modeFilter ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setModeFilter(undefined)}
            >
              All
            </Badge>
            {MODES.map((m) => (
              <Badge
                key={m.value}
                variant="outline"
                className={cn(
                  'cursor-pointer transition-all',
                  modeFilter === m.value
                    ? 'ring-2 ring-primary/40 ' + m.className
                    : m.className + ' opacity-70 hover:opacity-100'
                )}
                onClick={() =>
                  setModeFilter(modeFilter === m.value ? undefined : m.value)
                }
              >
                {m.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Document table */}
        <DocumentList
          variant="full"
          category={categoryFilter}
          search={search || undefined}
          modeFilter={modeFilter}
          groupByCategory={groupByCategory}
          onSelectDocument={handleSelectDocument}
        />

        {/* Detail dialog */}
        <DocumentDetail
          documentId={selectedDocId}
          open={detailOpen}
          onOpenChange={setDetailOpen}
        />
      </div>
    </div>
  );
}
