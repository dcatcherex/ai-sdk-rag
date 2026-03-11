'use client';

import { DocumentDetailPanel } from '@/components/knowledge/document-detail-panel';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';

interface DocumentDetailProps {
  documentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocumentDetail({
  documentId,
  open,
  onOpenChange,
}: DocumentDetailProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {documentId ? (
          <DocumentDetailPanel
            documentId={documentId}
            onDeleteSuccess={() => onOpenChange(false)}
            showOpenPageLink
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
