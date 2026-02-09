'use client';

import { useState } from 'react';
import { FileTextIcon, Trash2Icon, Loader2Icon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  useDocuments,
  useDeleteDocument,
  type DocumentItem,
} from '@/lib/hooks/use-documents';
import { cn } from '@/lib/utils';

interface DocumentListProps {
  variant?: 'compact' | 'full';
  category?: string;
  search?: string;
  onSelectDocument?: (doc: DocumentItem) => void;
  selectedDocIds?: Set<string>;
  onToggleSelect?: (docId: string) => void;
}

export function DocumentList({
  variant = 'compact',
  category,
  search,
  onSelectDocument,
  selectedDocIds,
  onToggleSelect,
}: DocumentListProps) {
  const [page, setPage] = useState(1);
  const limit = variant === 'compact' ? 50 : 20;
  const { data, isLoading } = useDocuments(page, limit, category, search);
  const deleteMutation = useDeleteDocument();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.documents.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <FileTextIcon className="size-8 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">
          No documents yet. Upload files to build your knowledge base.
        </p>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  if (variant === 'compact') {
    return (
      <ScrollArea className="h-full">
        <div className="space-y-1.5 pr-2">
          {data.documents.map((doc) => {
            const isSelected = selectedDocIds?.has(doc.id) ?? false;
            return (
              <div
                key={doc.id}
                className={cn(
                  'group flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition',
                  isSelected
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-black/5 bg-white/60 hover:bg-white'
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
                  className="flex min-w-0 flex-1 items-start gap-2.5"
                  onClick={() => onSelectDocument?.(doc)}
                >
                  <FileTextIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">
                      {doc.metadata.title || doc.metadata.fileName || 'Untitled'}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                        {doc.metadata.category || 'general'}
                      </Badge>
                      {doc.chunkCount > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {doc.chunkCount} chunks
                        </span>
                      )}
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

  // Full variant for the /knowledge page
  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white/70">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/5 text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Chunks</th>
              <th className="px-4 py-3 font-medium">Added</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {data.documents.map((doc) => (
              <tr
                key={doc.id}
                className={cn(
                  'cursor-pointer border-b border-black/[0.03] transition last:border-0 hover:bg-black/[0.02]',
                  deleteMutation.isPending &&
                    deleteMutation.variables === doc.id &&
                    'opacity-50'
                )}
                onClick={() => onSelectDocument?.(doc)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileTextIcon className="size-4 text-muted-foreground" />
                    <span className="font-medium">
                      {doc.metadata.title || doc.metadata.fileName || 'Untitled'}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="secondary" className="text-[11px]">
                    {doc.metadata.category || 'general'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {doc.chunkCount || '-'}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDate(doc.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate(doc.id);
                    }}
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.totalPages > 1 && (
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
