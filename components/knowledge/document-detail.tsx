'use client';

import { useState } from 'react';
import { FileTextIcon, Trash2Icon, Loader2Icon, HashIcon, RefreshCwIcon, BookOpenIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useDocument, useDeleteDocument } from '@/lib/hooks/use-documents';
import { ReprocessDialog } from '@/components/knowledge/reprocess-dialog';

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
  const { data, isLoading } = useDocument(documentId);
  const deleteMutation = useDeleteDocument();
  const [reprocessOpen, setReprocessOpen] = useState(false);

  const handleDelete = async () => {
    if (!documentId) return;
    await deleteMutation.mutateAsync(documentId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileTextIcon className="size-5" />
                {data.document.metadata.title ||
                  data.document.metadata.fileName ||
                  'Untitled Document'}
              </DialogTitle>
              <DialogDescription>
                <span className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {data.document.metadata.category || 'general'}
                  </Badge>
                  {data.document.metadata.fileType && (
                    <Badge variant="outline">
                      .{data.document.metadata.fileType}
                    </Badge>
                  )}
                  {data.document.processingMode && (
                    <Badge
                      variant="outline"
                      className={
                        data.document.processingMode === 'precise'
                          ? 'border-blue-200 text-blue-700 dark:border-blue-700 dark:text-blue-300'
                          : data.document.processingMode === 'optimized'
                          ? 'border-amber-200 text-amber-700 dark:border-amber-700 dark:text-amber-300'
                          : 'border-zinc-200 text-zinc-600 dark:border-zinc-600 dark:text-zinc-400'
                      }
                    >
                      {data.document.processingMode}
                    </Badge>
                  )}
                  {data.chunks.length > 0 && (
                    <span className="text-muted-foreground">
                      {data.chunks.length} chunk{data.chunks.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {data.document.content.length.toLocaleString()} chars
                  </span>
                </span>
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[50vh]">
              <div className="space-y-4">
                {/* Content preview */}
                <div>
                  <h4 className="mb-2 text-xs font-medium text-muted-foreground">
                    Content Preview
                  </h4>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl border border-black/5 bg-black/[0.02] p-3 text-xs leading-relaxed">
                    {data.document.content.slice(0, 2000)}
                    {data.document.content.length > 2000 ? '...' : ''}
                  </pre>
                </div>

                {/* Chunks */}
                {data.chunks.length > 0 && (
                  <div>
                    <Separator className="mb-4" />
                    <h4 className="mb-2 text-xs font-medium text-muted-foreground">
                      Chunks ({data.chunks.length})
                    </h4>
                    <div className="space-y-2">
                      {data.chunks.map((chunk) => {
                        const page = chunk.metadata?.page;
                        const section = chunk.metadata?.section;
                        return (
                          <div
                            key={chunk.id}
                            className="rounded-xl border border-black/5 bg-black/[0.01] p-3"
                          >
                            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                              <HashIcon className="size-3 text-muted-foreground" />
                              <span className="text-[10px] font-medium text-muted-foreground">
                                Chunk {chunk.chunkIndex + 1}
                              </span>
                              {typeof page === 'number' && (
                                <span className="flex items-center gap-0.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                  <BookOpenIcon className="size-2.5" /> p.{page}
                                </span>
                              )}
                              {section && (
                                <span className="max-w-[180px] truncate rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                  {section}
                                </span>
                              )}
                            </div>
                            <p className="text-xs leading-relaxed text-foreground/80">
                              {chunk.content.slice(0, 300)}
                              {chunk.content.length > 300 ? '...' : ''}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReprocessOpen(true)}
              >
                <RefreshCwIcon className="mr-1.5 size-3.5" />
                Reprocess
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <Trash2Icon className="mr-1.5 size-3.5" />
                )}
                Delete
              </Button>
            </DialogFooter>

            {documentId && (
              <ReprocessDialog
                documentId={documentId}
                currentMode={data.document.processingMode ?? undefined}
                open={reprocessOpen}
                onOpenChange={setReprocessOpen}
              />
            )}
          </>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Document not found.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
