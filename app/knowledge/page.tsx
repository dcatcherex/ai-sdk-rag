'use client';

import { useState } from 'react';
import { ArrowLeftIcon, SearchIcon, DatabaseIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DocumentUpload } from '@/components/knowledge/document-upload';
import { DocumentList } from '@/components/knowledge/document-list';
import { DocumentDetail } from '@/components/knowledge/document-detail';
import { useDocumentStats, type DocumentItem } from '@/lib/hooks/use-documents';
import Link from 'next/link';

export default function KnowledgePage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { data: stats } = useDocumentStats();

  const handleSelectDocument = (doc: DocumentItem) => {
    setSelectedDocId(doc.id);
    setDetailOpen(true);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f7f7f9,_#eef0f7_55%,_#e6e9f2_100%)] dark:bg-[radial-gradient(circle_at_top,_#1a1b2e,_#111827_55%,_#0f172a_100%)]">
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
              <h1 className="text-xl font-semibold text-foreground">
                Knowledge Base
              </h1>
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
        <div className="mb-8 rounded-3xl border border-black/5 dark:border-white/10 bg-white/70 dark:bg-zinc-900/80 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.25)] dark:shadow-[0_20px_60px_-40px_rgba(0,0,0,0.5)] backdrop-blur">
          <h2 className="mb-4 text-sm font-semibold">Upload Documents</h2>
          <DocumentUpload variant="full" />
        </div>

        {/* Search and filter */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1">
            <SearchIcon className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input
              className="pl-9 text-sm"
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {stats && stats.categories.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant={!categoryFilter ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setCategoryFilter(undefined)}
              >
                All
              </Badge>
              {stats.categories.map((cat) => (
                <Badge
                  key={cat.name}
                  variant={categoryFilter === cat.name ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() =>
                    setCategoryFilter(
                      categoryFilter === cat.name ? undefined : cat.name
                    )
                  }
                >
                  {cat.name} ({cat.count})
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Document table */}
        <DocumentList
          variant="full"
          category={categoryFilter}
          search={search || undefined}
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
