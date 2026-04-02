'use client';

import { FileTextIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DocumentUpload } from '@/components/knowledge/document-upload';
import { useDocuments, useBulkDeleteDocuments } from '@/lib/hooks/use-documents';

type Props = {
  brandId: string;
};

const DOC_TYPE_LABELS: Record<string, string> = {
  'brand-guide': 'Brand guide',
  'product-doc': 'Product doc',
  'faq': 'FAQ',
  'case-study': 'Case study',
  'testimonial': 'Testimonial',
};

export function BrandKnowledgeTab({ brandId }: Props) {
  const category = `brand-${brandId}`;
  const { data, refetch } = useDocuments(1, 50, category);
  const deleteDocs = useBulkDeleteDocuments();

  const docs = data?.documents ?? [];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium">Brand knowledge base</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Upload brand guides, product docs, FAQs, and case studies. Agents use this when
          generating content for this brand.
        </p>
      </div>

      <DocumentUpload
        variant="compact"
        defaultCategory={category}
        onUploadComplete={refetch}
      />

      {docs.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {docs.length} document{docs.length !== 1 ? 's' : ''}
          </p>
          {docs.map((doc) => {
            const title = (doc.metadata?.title as string) || 'Untitled';
            const fileType = (doc.metadata?.fileType as string) || '';
            const docType = (doc.metadata?.docType as string) || '';
            const status = doc.processingStatus;

            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 rounded-lg border border-black/5 dark:border-border bg-muted/20 px-3 py-2"
              >
                <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {fileType && (
                      <span className="text-xs text-muted-foreground uppercase">{fileType}</span>
                    )}
                    {docType && DOC_TYPE_LABELS[docType] && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                        {DOC_TYPE_LABELS[docType]}
                      </Badge>
                    )}
                    {status === 'processing' && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-amber-600">
                        Processing
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteDocs.mutate([doc.id], { onSuccess: () => refetch() })}
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {docs.length === 0 && (
        <p className="text-xs text-muted-foreground italic text-center py-2">
          No documents yet. Upload brand materials above so agents can reference them.
        </p>
      )}
    </div>
  );
}
