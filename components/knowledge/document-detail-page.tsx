'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon } from 'lucide-react';
import { DocumentDetailPanel } from '@/components/knowledge/document-detail-panel';
import { Button } from '@/components/ui/button';

type DocumentDetailPageProps = {
  documentId: string;
};

export function DocumentDetailPage({ documentId }: DocumentDetailPageProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f2f0fa,_#e8e4f5_55%,_#dddaf0_100%)] dark:bg-[radial-gradient(circle_at_top,_#1c1a2e,_#181628_55%,_#141220_100%)]">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6 flex items-center gap-4">
          <Link href="/knowledge">
            <Button variant="outline" size="icon" className="size-9">
              <ArrowLeftIcon className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Document Detail</h1>
            <p className="text-xs text-muted-foreground">
              View document content, chunks, and processing metadata.
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-black/5 bg-card/70 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.25)] backdrop-blur dark:border-border dark:bg-card/80 dark:shadow-[0_20px_60px_-40px_rgba(0,0,0,0.5)]">
          <DocumentDetailPanel
            documentId={documentId}
            scrollAreaClassName="max-h-[70vh]"
            onDeleteSuccess={() => router.push('/knowledge')}
          />
        </div>
      </div>
    </div>
  );
}
