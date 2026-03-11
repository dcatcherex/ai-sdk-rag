'use client';

import { useState } from 'react';
import { Loader2Icon, RefreshCwIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ProcessingModeSelector } from '@/components/knowledge/processing-mode-selector';
import { useReprocessDocument, type ProcessingMode } from '@/lib/hooks/use-documents';
import { DEFAULT_PRECISE_MODEL } from '@/lib/document-precise';

interface ReprocessDialogProps {
  documentId: string;
  currentMode?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReprocessDialog({ documentId, currentMode, open, onOpenChange }: ReprocessDialogProps) {
  const [mode, setMode] = useState<ProcessingMode>((currentMode as ProcessingMode) || 'optimized');
  const [modelId, setModelId] = useState(DEFAULT_PRECISE_MODEL);
  const reprocess = useReprocessDocument();

  const handleConfirm = async () => {
    await reprocess.mutateAsync({
      id: documentId,
      processingMode: mode,
      ...(mode === 'precise' ? { modelId } : {}),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <RefreshCwIcon className="size-4" />
            Reprocess Document
          </DialogTitle>
          <DialogDescription className="text-xs">
            Choose a new processing mode. The document will be re-indexed with the new settings.
            {currentMode && (
              <span className="ml-1 font-medium">Current: {currentMode}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <ProcessingModeSelector
          value={mode}
          onChange={setMode}
          modelId={modelId}
          onModelChange={setModelId}
        />

        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="flex-1"
            onClick={handleConfirm}
            disabled={reprocess.isPending}
          >
            {reprocess.isPending ? (
              <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <RefreshCwIcon className="mr-1.5 size-3.5" />
            )}
            {reprocess.isPending ? 'Processing…' : 'Reprocess'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)} disabled={reprocess.isPending}>
            Cancel
          </Button>
        </div>

        {reprocess.isError && (
          <p className="text-xs text-destructive">
            {reprocess.error instanceof Error ? reprocess.error.message : 'Reprocessing failed'}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
