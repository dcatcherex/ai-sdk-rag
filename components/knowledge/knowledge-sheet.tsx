'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { KnowledgePanel } from './knowledge-panel';

type KnowledgeSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDocIds: Set<string>;
  onToggleSelect: (docId: string) => void;
  totalDocuments?: number;
};

export function KnowledgeSheet({
  open,
  onOpenChange,
  selectedDocIds,
  onToggleSelect,
  totalDocuments,
}: KnowledgeSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-hidden p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-black/5 px-6 py-4 dark:border-border">
          <SheetTitle>Knowledge base</SheetTitle>
          <SheetDescription>
            Browse, upload, and select source documents for the current conversation.
            {typeof totalDocuments === 'number' ? ` ${totalDocuments} document${totalDocuments === 1 ? '' : 's'} available.` : ''}
          </SheetDescription>
        </SheetHeader>

        <div className="h-[calc(100%-5.5rem)]">
          <KnowledgePanel
            selectedDocIds={selectedDocIds}
            onToggleSelect={onToggleSelect}
            className="h-full w-full rounded-none border-0 bg-transparent shadow-none"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
