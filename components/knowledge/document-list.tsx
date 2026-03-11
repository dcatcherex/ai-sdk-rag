'use client';

import { useState } from 'react';
import {
  FileTextIcon,
  Trash2Icon,
  Loader2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  CheckCircle2Icon,
  ClockIcon,
  LinkIcon,
  ImageIcon,
  ChevronRightIcon as CollapseIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  useDocuments,
  useDeleteDocument,
  useBulkDeleteDocuments,
  type DocumentItem,
} from '@/lib/hooks/use-documents';
import { cn } from '@/lib/utils';

type SortCol = 'name' | 'category' | 'mode' | 'chunks' | 'date';

interface DocumentListProps {
  variant?: 'compact' | 'full';
  category?: string;
  search?: string;
  modeFilter?: string;
  groupByCategory?: boolean;
  onSelectDocument?: (doc: DocumentItem) => void;
  selectedDocIds?: Set<string>;
  onToggleSelect?: (docId: string) => void;
}

function getDocName(doc: DocumentItem) {
  return doc.metadata.title || doc.metadata.fileName || 'Untitled';
}

function getFileIcon(doc: DocumentItem) {
  const ft = doc.metadata.fileType || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'tiff'].includes(ft)) {
    return <ImageIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />;
  }
  if (ft === 'url') {
    return <LinkIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />;
  }
  return <FileTextIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />;
}

function StatusBadge({ doc }: { doc: DocumentItem }) {
  if (doc.processingStatus === 'pending') {
    return (
      <span className="inline-flex min-w-0 max-w-full items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
        <ClockIcon className="size-3" />
        Processing
      </span>
    );
  }
  if (doc.chunkCount > 0) {
    return (
      <span className="inline-flex min-w-0 max-w-full items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
        <CheckCircle2Icon className="size-3" />
        {doc.chunkCount} chunks
      </span>
    );
  }
  if (doc.storageMode === 'context') {
    return (
      <span className="inline-flex min-w-0 max-w-full text-[11px] text-blue-600 dark:text-blue-400">context</span>
    );
  }
  return <span className="inline-flex min-w-0 max-w-full text-[11px] text-muted-foreground">—</span>;
}

function ModeBadge({ mode }: { mode?: string | null }) {
  if (!mode) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[11px]',
        mode === 'precise'
          ? 'border-blue-200 text-blue-700 dark:border-blue-700 dark:text-blue-300'
          : mode === 'optimized'
          ? 'border-amber-200 text-amber-700 dark:border-amber-700 dark:text-amber-300'
          : 'border-zinc-200 text-zinc-500 dark:border-zinc-600 dark:text-zinc-400'
      )}
    >
      {mode}
    </Badge>
  );
}

function SortHeader({
  col,
  label,
  sortCol,
  sortDir,
  onSort,
  className,
}: {
  col: SortCol;
  label: string;
  sortCol: SortCol;
  sortDir: 'asc' | 'desc';
  onSort: (col: SortCol) => void;
  className?: string;
}) {
  const active = sortCol === col;
  return (
    <th
      className={cn('px-4 py-3 font-medium cursor-pointer select-none whitespace-nowrap', className)}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="text-muted-foreground/60">
          {active ? (
            sortDir === 'asc' ? <ChevronUpIcon className="size-3" /> : <ChevronDownIcon className="size-3" />
          ) : (
            <ChevronUpIcon className="size-3 opacity-0 group-hover:opacity-40" />
          )}
        </span>
      </span>
    </th>
  );
}

function formatDate(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function DocumentList({
  variant = 'compact',
  category,
  search,
  modeFilter,
  groupByCategory = false,
  onSelectDocument,
  selectedDocIds,
  onToggleSelect,
}: DocumentListProps) {
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState<SortCol>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // When grouping, fetch more docs and ignore category filter
  const limit = variant === 'compact' ? 50 : groupByCategory ? 200 : 20;
  const effectiveCategory = groupByCategory ? undefined : category;

  const { data, isLoading } = useDocuments(
    page,
    limit,
    effectiveCategory,
    search,
    modeFilter,
    sortCol,
    sortDir,
  );
  const deleteMutation = useDeleteDocument();
  const bulkDeleteMutation = useBulkDeleteDocuments();

  const handleSort = (col: SortCol) => {
    if (col === sortCol) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
    setPage(1);
  };

  const docs = data?.documents ?? [];
  const allIds = docs.map((d) => d.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(allIds));
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ids = [...selectedIds];
    setSelectedIds(new Set());
    await bulkDeleteMutation.mutateAsync(ids);
  };

  const toggleGroupCollapse = (cat: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // --- COMPACT VARIANT ---
  if (variant === 'compact') {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
        </div>
      );
    }
    if (!data || docs.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <FileTextIcon className="size-8 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">
            No documents yet. Upload files to build your knowledge base.
          </p>
        </div>
      );
    }
    return (
      <ScrollArea className="h-full">
        <div className="space-y-1.5 pr-2">
          {docs.map((doc) => {
            const isSelected = selectedDocIds?.has(doc.id) ?? false;
            return (
              <div
                key={doc.id}
                className={cn(
                  'group flex w-full items-start gap-2 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition',
                  isSelected
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-black/5 dark:border-border bg-white/60 dark:bg-muted/60 hover:bg-white dark:hover:bg-secondary/60'
                )}
              >
                {onToggleSelect && (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelect(doc.id)}
                    className="mt-0.5 shrink-0"
                  />
                )}
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-start gap-2.5 overflow-hidden"
                  onClick={() => onSelectDocument?.(doc)}
                >
                  {getFileIcon(doc)}
                  <div className="min-w-0 flex-1">
                    <p className="block max-w-full truncate text-xs font-medium leading-5">{getDocName(doc)}</p>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="h-4 shrink-0 px-1.5 text-[10px]">
                        {doc.metadata.category || 'general'}
                      </Badge>
                      <div className="min-w-0 max-w-full">
                        <StatusBadge doc={doc} />
                      </div>
                    </div>
                  </div>
                </button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        role="button"
                        className="mt-0.5 hidden shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive group-hover:block"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(doc.id);
                        }}
                      >
                        <Trash2Icon className="size-3" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Delete document</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    );
  }

  // --- FULL VARIANT ---
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || docs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-black/5 dark:border-border bg-white/70 dark:bg-card/80 py-16 text-center">
        <FileTextIcon className="size-10 text-muted-foreground/30" />
        <div>
          <p className="text-sm font-medium text-foreground">No documents found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try adjusting your filters or upload new documents.
          </p>
        </div>
      </div>
    );
  }

  // Group by category
  const grouped: Record<string, DocumentItem[]> | null = groupByCategory
    ? docs.reduce(
        (acc, doc) => {
          const cat = doc.metadata.category || 'general';
          if (!acc[cat]) acc[cat] = [];
          acc[cat].push(doc);
          return acc;
        },
        {} as Record<string, DocumentItem[]>
      )
    : null;

  const renderRow = (doc: DocumentItem) => {
    const isDeleting = deleteMutation.isPending && deleteMutation.variables === doc.id;
    const isSelected = selectedIds.has(doc.id);
    return (
      <tr
        key={doc.id}
        className={cn(
          'cursor-pointer border-b border-black/[0.03] dark:border-white/[0.06] transition last:border-0',
          isDeleting && 'opacity-40 pointer-events-none',
          isSelected
            ? 'bg-primary/5 hover:bg-primary/10'
            : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.04]'
        )}
        onClick={() => onSelectDocument?.(doc)}
      >
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => toggleOne(doc.id)}
          />
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            {getFileIcon(doc)}
            <span className="font-medium truncate max-w-xs">{getDocName(doc)}</span>
          </div>
        </td>
        {!groupByCategory && (
          <td className="px-4 py-3">
            <Badge variant="secondary" className="text-[11px]">
              {doc.metadata.category || 'general'}
            </Badge>
          </td>
        )}
        <td className="px-4 py-3">
          <ModeBadge mode={doc.processingMode} />
        </td>
        <td className="px-4 py-3">
          <StatusBadge doc={doc} />
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
          {formatDate(doc.createdAt)}
        </td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <Button
            size="icon"
            variant="ghost"
            className="size-7 text-muted-foreground hover:text-destructive"
            disabled={isDeleting}
            onClick={() => deleteMutation.mutate(doc.id)}
          >
            {isDeleting ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <Trash2Icon className="size-3.5" />
            )}
          </Button>
        </td>
      </tr>
    );
  };

  const tableHeader = (
    <thead>
      <tr className="border-b border-black/5 dark:border-border text-left text-xs text-muted-foreground group">
        <th className="px-4 py-3">
          <Checkbox
            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
            onCheckedChange={toggleAll}
          />
        </th>
        <SortHeader col="name" label="Name" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
        {!groupByCategory && (
          <SortHeader col="category" label="Category" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
        )}
        <SortHeader col="mode" label="Mode" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
        <SortHeader col="chunks" label="Status" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
        <SortHeader col="date" label="Added" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
        <th className="px-4 py-3" />
      </tr>
    </thead>
  );

  return (
    <div className="space-y-3">
      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium text-foreground">
            {selectedIds.size} selected
          </span>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setSelectedIds(new Set())}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="h-7 text-xs"
            disabled={bulkDeleteMutation.isPending}
            onClick={handleBulkDelete}
          >
            {bulkDeleteMutation.isPending ? (
              <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Trash2Icon className="mr-1.5 size-3.5" />
            )}
            Delete {selectedIds.size} document{selectedIds.size !== 1 ? 's' : ''}
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-black/5 dark:border-border bg-white/70 dark:bg-card/80">
        {grouped ? (
          // Grouped view
          <div>
            {Object.entries(grouped)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([cat, catDocs]) => {
                const isCollapsed = collapsedGroups.has(cat);
                return (
                  <div key={cat} className="border-b border-black/[0.04] dark:border-white/[0.06] last:border-0">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition"
                      onClick={() => toggleGroupCollapse(cat)}
                    >
                      <CollapseIcon
                        className={cn(
                          'size-3.5 text-muted-foreground transition-transform',
                          !isCollapsed && 'rotate-90'
                        )}
                      />
                      <span className="text-xs font-semibold text-foreground">{cat}</span>
                      <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                        {catDocs.length}
                      </Badge>
                    </button>
                    {!isCollapsed && (
                      <table className="w-full text-sm">
                        {tableHeader}
                        <tbody>{catDocs.map(renderRow)}</tbody>
                      </table>
                    )}
                  </div>
                );
              })}
          </div>
        ) : (
          // Flat view
          <table className="w-full text-sm">
            {tableHeader}
            <tbody>{docs.map(renderRow)}</tbody>
          </table>
        )}
      </div>

      {/* Pagination (only in flat view with multiple pages) */}
      {!groupByCategory && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {data.total} document{data.total !== 1 ? 's' : ''} total
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              className="size-7"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeftIcon className="size-3.5" />
            </Button>
            <span className="px-2 text-xs text-muted-foreground">
              {page} / {data.totalPages}
            </span>
            <Button
              size="icon"
              variant="outline"
              className="size-7"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRightIcon className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
