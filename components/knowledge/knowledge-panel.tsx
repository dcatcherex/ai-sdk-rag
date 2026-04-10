'use client';

import { useState } from 'react';
import { SearchIcon, ExternalLinkIcon, LayersIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { DocumentUpload } from './document-upload';
import { DocumentList } from './document-list';
import { DocumentDetail } from './document-detail';
import { useDocumentStats, type DocumentItem } from '@/lib/hooks/use-documents';
import Link from 'next/link';

const RERANK_CHUNK_THRESHOLD = 3000;

interface KnowledgePanelProps {
  selectedDocIds?: Set<string>;
  onToggleSelect?: (docId: string) => void;
  className?: string;
}

export function KnowledgePanel({ selectedDocIds, onToggleSelect, className }: KnowledgePanelProps) {
  const [search, setSearch] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { data: stats } = useDocumentStats();

  const handleSelectDocument = (doc: DocumentItem) => {
    setSelectedDocId(doc.id);
    setDetailOpen(true);
  };

  const WIDTH = 'w-70';

  return (
    <aside
      className={cn(
        `flex h-full ${WIDTH} shrink-0 flex-col rounded-3xl border border-black/5 bg-white/70 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)] backdrop-blur dark:border-border dark:bg-card/80 dark:shadow-[0_20px_60px_-40px_rgba(0,0,0,0.6)]`,
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3.5">
        <div className="flex items-center justify-between">
          <div>
            
            <h3 className="text-sm font-semibold text-foreground">
              Knowledge
              {stats && stats.totalDocuments > 0 && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  ({stats.totalDocuments})
                </span>
              )}
              {selectedDocIds && selectedDocIds.size > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {selectedDocIds.size} selected
                </span>
              )}
            </h3>
          </div>
          <Link
            href="/knowledge"
            className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ExternalLinkIcon className="size-4" />
          </Link>
        </div>
      </div>

      <div className="px-4">
        <Separator />
      </div>

      {/* Upload */}
      <div className="px-4 pt-3">
        <DocumentUpload variant="compact" />
      </div>

      {/* Search */}
      <div className="relative px-4 pt-3">
        <SearchIcon className="absolute top-5.5 left-7 size-3.5 text-muted-foreground" />
        <Input
          className="h-8 pl-8 text-xs"
          placeholder="Search documents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Document list */}
      <div className="min-h-0 flex-1 pt-3 pb-4">
        <ScrollArea className="h-full">
          <DocumentList
            variant="compact"
            search={search || undefined}
            onSelectDocument={handleSelectDocument}
            selectedDocIds={selectedDocIds}
            onToggleSelect={onToggleSelect}
          />
        </ScrollArea>
      </div>

      {/* Rerank suggestion banner — shown when KB is large enough to benefit */}
      {stats && stats.totalChunks >= RERANK_CHUNK_THRESHOLD && (
        <div className="mx-4 mb-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-800/50 dark:bg-blue-950/30">
          <div className="flex items-start gap-2">
            <LayersIcon className="mt-0.5 size-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-blue-800 dark:text-blue-200">
                Large knowledge base detected
              </p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-blue-700/80 dark:text-blue-300/70">
                {stats.totalChunks.toLocaleString()} chunks — enable{' '}
                <Link href="/settings" className="underline underline-offset-2 hover:text-blue-900 dark:hover:text-blue-100">
                  Reranking in Settings
                </Link>{' '}
                for better search precision.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Document detail dialog */}
      <DocumentDetail
        documentId={selectedDocId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </aside>
  );
}
