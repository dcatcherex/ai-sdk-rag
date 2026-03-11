'use client';

import { useState } from 'react';
import { Loader2Icon, SendIcon, EyeIcon, AlertTriangleIcon, CheckCircle2Icon, XIcon, InfoIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useProcessDocument, type DocumentAnalysis, type ProcessingMode } from '@/lib/hooks/use-documents';
import { ProcessingModeSelector } from '@/components/knowledge/processing-mode-selector';
import { DEFAULT_PRECISE_MODEL } from '@/lib/document-precise';
import { cn } from '@/lib/utils';

interface ProcessingNotificationProps {
  pendingDocumentId: string;
  title: string;
  analysis: DocumentAnalysis;
  initialMode?: ProcessingMode;
  isImageBased?: boolean;
  onDone: () => void;
  onDismiss: () => void;
}

export function ProcessingNotification({
  pendingDocumentId,
  title,
  analysis,
  initialMode,
  isImageBased = false,
  onDone,
  onDismiss,
}: ProcessingNotificationProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [mode, setMode] = useState<ProcessingMode>(
    initialMode ?? (analysis.recommendRAG ? 'optimized' : 'raw')
  );
  const [modelId, setModelId] = useState(DEFAULT_PRECISE_MODEL);
  const process = useProcessDocument();

  const noisePercent = Math.round(analysis.noiseRatio * 100);
  const hasNoise = analysis.noisySections.length > 0;

  const handleConfirm = async () => {
    const action = mode === 'precise' ? 'precise' : mode === 'optimized' ? 'clean_and_save' : 'save_as_is';
    await process.mutateAsync({
      id: pendingDocumentId,
      action: action as any,
      ...(mode === 'precise' ? { modelId } : {}),
    });
    onDone();
  };

  return (
    <>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-950/30">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                Document ready to process
              </p>
              <p className="text-xs text-amber-700/80 dark:text-amber-300/70 truncate max-w-xs">{title}</p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="text-amber-500 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-200"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        {/* Stats row */}
        <div className="mb-3 flex flex-wrap gap-2">
          <Badge variant="outline" className="text-xs border-amber-200 text-amber-800 dark:border-amber-700 dark:text-amber-200">
            {analysis.wordCount.toLocaleString()} words
          </Badge>
          <Badge variant="outline" className="text-xs border-amber-200 text-amber-800 dark:border-amber-700 dark:text-amber-200">
            ~{analysis.estimatedTokens.toLocaleString()} tokens
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              'text-xs',
              analysis.recommendRAG
                ? 'border-blue-200 text-blue-800 dark:border-blue-700 dark:text-blue-200'
                : 'border-green-200 text-green-800 dark:border-green-700 dark:text-green-200'
            )}
          >
            {analysis.recommendRAG ? 'RAG recommended' : 'Context injection'}
          </Badge>
        </div>

        {/* Noise indicator */}
        {hasNoise && (
          <div className="mb-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-300">
              <span>Noise detected</span>
              <span>{noisePercent}%</span>
            </div>
            <Progress
              value={noisePercent}
              className="h-1.5 bg-amber-200 dark:bg-amber-800 [&>div]:bg-amber-500"
            />
            <div className="flex flex-wrap gap-1">
              {analysis.noisySections.map((s) => (
                <span
                  key={s.label}
                  className="rounded-full bg-amber-200/60 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-800/40 dark:text-amber-200"
                >
                  {s.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Storage mode reason */}
        <p className="mb-3 text-xs text-amber-700/80 dark:text-amber-300/70">
          {analysis.storageModeReason}
        </p>

        {/* Context size warning — shown for large context-mode docs */}
        {!analysis.recommendRAG && analysis.contextSizeWarning && (
          <div className={`mb-2 rounded-lg border px-3 py-2 ${
            analysis.contextSizeWarning.includes('exceeds the effective')
              ? 'border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-950/30'
              : 'border-yellow-200 bg-yellow-50 dark:border-yellow-800/50 dark:bg-yellow-950/30'
          }`}>
            <div className="flex items-start gap-1.5">
              <InfoIcon className={`mt-0.5 size-3.5 shrink-0 ${
                analysis.contextSizeWarning.includes('exceeds the effective')
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-yellow-700 dark:text-yellow-400'
              }`} />
              <p className={`text-[11px] leading-relaxed ${
                analysis.contextSizeWarning.includes('exceeds the effective')
                  ? 'text-red-800 dark:text-red-200'
                  : 'text-yellow-800 dark:text-yellow-200'
              }`}>
                {analysis.contextSizeWarning}
              </p>
            </div>
          </div>
        )}

        {/* Image-based warning */}
        {isImageBased && (
          <div className="mb-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-800/50 dark:bg-blue-950/30">
            <p className="text-xs font-medium text-blue-800 dark:text-blue-200">
              Image-based document detected
            </p>
            <p className="mt-0.5 text-[11px] text-blue-700/80 dark:text-blue-300/70">
              This document has no readable text layer. Only Precise mode can extract its content using vision AI.
            </p>
          </div>
        )}

        {/* Mode selector */}
        <ProcessingModeSelector
          value={mode}
          onChange={setMode}
          modelId={modelId}
          onModelChange={setModelId}
          compact
          disabledModes={isImageBased ? ['optimized', 'raw'] : []}
        />

        {/* Confirm + details */}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            size="sm"
            className="h-8 gap-1.5"
            onClick={handleConfirm}
            disabled={process.isPending}
          >
            {process.isPending ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <SendIcon className="size-3.5" />
            )}
            {process.isPending ? 'Processing…' : 'Process & Save'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
            onClick={() => setShowDetails(true)}
          >
            <EyeIcon className="size-3.5" />
            Details
          </Button>
        </div>

        {process.isError && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">
            {process.error instanceof Error ? process.error.message : 'Processing failed'}
          </p>
        )}
      </div>

      {/* Details dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Document Analysis</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Words</p>
                <p className="font-semibold">{analysis.wordCount.toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Est. Tokens</p>
                <p className="font-semibold">{analysis.estimatedTokens.toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Characters</p>
                <p className="font-semibold">{analysis.charCount.toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Noise Ratio</p>
                <p className="font-semibold">{noisePercent}%</p>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Storage Mode</p>
              <div className="flex items-center gap-2">
                <CheckCircle2Icon className="size-4 text-green-600" />
                <span>{analysis.recommendRAG ? 'RAG (vector search + chunking)' : 'Context injection (full document)'}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{analysis.storageModeReason}</p>
            </div>

            {hasNoise && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Detected Noisy Sections</p>
                <ul className="space-y-1">
                  {analysis.noisySections.map((s) => (
                    <li key={s.label} className="flex items-center justify-between text-xs">
                      <span>{s.label}</span>
                      <span className="text-muted-foreground">~{s.charCount} chars</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button
              size="sm"
              className="w-full"
              onClick={() => { setShowDetails(false); handleConfirm(); }}
              disabled={process.isPending}
            >
              {process.isPending ? <Loader2Icon className="mr-1.5 size-3.5 animate-spin" /> : <SendIcon className="mr-1.5 size-3.5" />}
              Process & Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
