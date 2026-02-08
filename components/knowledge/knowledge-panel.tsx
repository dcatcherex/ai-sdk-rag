'use client';

import { useState } from 'react';
import { SearchIcon, ExternalLinkIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { DocumentUpload } from './document-upload';
import { DocumentList } from './document-list';
import { DocumentDetail } from './document-detail';
import { useDocumentStats, type DocumentItem } from '@/lib/hooks/use-documents';
import Link from 'next/link';

interface KnowledgePanelProps {
  selectedDocIds?: Set<string>;
  onToggleSelect?: (docId: string) => void;
}

export function KnowledgePanel({ selectedDocIds, onToggleSelect }: KnowledgePanelProps) {
  const [search, setSearch] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { data: stats } = useDocumentStats();

  const handleSelectDocument = (doc: DocumentItem) => {
    setSelectedDocId(doc.id);
    setDetailOpen(true);
  };

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col rounded-3xl border border-black/5 bg-white/70 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)] backdrop-blur">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Knowledge
            </p>
            <h3 className="text-sm font-semibold text-foreground">
              Documents
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
            Manage
            <ExternalLinkIcon className="size-3" />
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
      <div className="min-h-0 flex-1 px-4 pt-3 pb-4">
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

      {/* Document detail dialog */}
      <DocumentDetail
        documentId={selectedDocId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </aside>
  );
}
