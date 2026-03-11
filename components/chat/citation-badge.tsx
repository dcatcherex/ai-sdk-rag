'use client';

import Link from 'next/link';
import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationSource,
} from '@/components/ai-elements/inline-citation';
import { Button } from '@/components/ui/button';
import { BookOpenIcon } from 'lucide-react';

interface CitationBadgeProps {
  documentId?: string;
  file: string;
  page: number;
  section?: string;
}

export function CitationBadge({ documentId, file, page, section }: CitationBadgeProps) {
  return (
    <InlineCitation className="mx-0.5 align-middle">
      <InlineCitationCard>
        <InlineCitationCardTrigger
          href={documentId ? `/knowledge/${documentId}` : undefined}
          sources={[file]}
          className="border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-800/50 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/40"
        >
          <BookOpenIcon className="size-2.5" />
          {file}, p.{page}
        </InlineCitationCardTrigger>
        <InlineCitationCardBody className="w-72 p-4">
          <InlineCitationSource
            title={file}
            description={section ? `Page ${page} · Section: ${section}` : `Page ${page}`}
          >
            {documentId ? (
              <div className="pt-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/knowledge/${documentId}`}>
                    Open document
                  </Link>
                </Button>
              </div>
            ) : null}
          </InlineCitationSource>
        </InlineCitationCardBody>
      </InlineCitationCard>
    </InlineCitation>
  );
}
