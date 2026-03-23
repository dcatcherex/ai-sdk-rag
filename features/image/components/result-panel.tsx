'use client';

import { ImageIcon, Loader2, CheckCircle2, XCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { ImageGenerationState } from '../types';
import type { Mode } from '../hooks/use-image-generator';

interface Props {
  state: ImageGenerationState;
  mode: Mode;
  onRetry: () => void;
  onNewImage: () => void;
  onUseAsReference: (url: string) => void;
}

export function ResultPanel({ state, mode, onRetry, onNewImage, onUseAsReference }: Props) {
  return (
    <div className="p-6 flex flex-col gap-4">
      <Label className="text-sm font-medium">Result</Label>

      {state.status === 'idle' && (
        <div className="flex-1 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 text-muted-foreground min-h-64">
          <ImageIcon className="h-10 w-10 opacity-20" />
          <p className="text-sm">Your generated image will appear here</p>
        </div>
      )}

      {state.status === 'polling' && (
        <div className="flex-1 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 text-muted-foreground min-h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Generating your image…</p>
            <p className="text-xs mt-1">This usually takes 15–60 seconds</p>
          </div>
        </div>
      )}

      {state.status === 'success' && state.output && (
        <div className="space-y-3">
          <div className="rounded-xl overflow-hidden border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={state.output} alt="Generated image" className="w-full object-contain max-h-[520px]" />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" /> Generation complete
            </div>
            <div className="flex-1" />
            <a
              href={state.output}
              download="generated-image"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
            >
              <Download className="h-3.5 w-3.5" /> Download
            </a>
            <Button variant="outline" size="sm" onClick={onNewImage}>New image</Button>
          </div>
          {mode === 'generate' && (
            <button
              onClick={() => onUseAsReference(state.output!)}
              className="w-full rounded-lg border border-dashed py-2 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
            >
              Use this image as reference for editing →
            </button>
          )}
        </div>
      )}

      {(state.status === 'failed' || state.status === 'timeout') && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 flex items-start gap-2 text-destructive text-sm">
          <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Generation failed</p>
            <p className="mt-0.5 text-xs">{state.error ?? 'Please try again.'}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>Try again</Button>
          </div>
        </div>
      )}
    </div>
  );
}
