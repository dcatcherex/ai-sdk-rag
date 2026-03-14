'use client';

import { useRouter } from 'next/navigation';
import { DocumentDetailPanel } from '@/components/knowledge/document-detail-panel';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { ArrowLeftIcon } from 'lucide-react';

type DocumentDetailPageProps = {
  documentId: string;
};

export function DocumentDetailPage({ documentId }: DocumentDetailPageProps) {
  const router = useRouter();

  return (
    <>
      <PageHeader
        title="Document Detail"
        description="View document content, chunks, and processing metadata."
        action={
          <Button variant="outline" size="sm" onClick={() => router.push('/knowledge')}>
            <ArrowLeftIcon className="mr-2 size-4" />
            Back
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
        <div className="rounded-2xl border border-black/5 dark:border-border bg-white/60 dark:bg-muted/30 p-6">
          <DocumentDetailPanel
            documentId={documentId}
            scrollAreaClassName="max-h-[70vh]"
            onDeleteSuccess={() => router.push('/knowledge')}
          />
        </div>
      </div>
    </>
  );
}
