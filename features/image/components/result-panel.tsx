'use client';

import Image from 'next/image';
import { ImageIcon, Loader2, CheckCircle2, XCircle, Download, ExternalLink, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

function triggerBrowserDownload(url: string, filename: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function ResultPanel({ state, mode, onRetry, onNewImage, onUseAsReference }: Props) {
  const outputUrls = state.outputs?.length ? state.outputs : state.output ? [state.output] : [];
  const handleDownloadAll = () => {
    outputUrls.forEach((url, index) => {
      window.setTimeout(() => {
        triggerBrowserDownload(url, `generated-image-${index + 1}`);
      }, index * 150);
    });
  };

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

      {state.status === 'success' && outputUrls.length > 0 && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {outputUrls.map((url, index) => (
              <div key={`${url}-${index}`} className="group relative rounded-xl overflow-hidden border">
                <Image src={url} alt={`Generated image ${index + 1}`} width={1536} height={1024} unoptimized className="w-full object-contain max-h-[520px] h-auto" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="absolute right-3 bottom-3 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button asChild size="icon" variant="secondary" className="pointer-events-auto rounded-full shadow-sm">
                    <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open image ${index + 1}`}>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="pointer-events-auto rounded-full shadow-sm"
                    onClick={() => triggerBrowserDownload(url, `generated-image-${index + 1}`)}
                    aria-label={`Download image ${index + 1}`}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" /> {outputUrls.length === 1 ? 'Generation complete' : `${outputUrls.length} images generated`}
            </div>
            <div className="flex-1" />
            <a
              href={outputUrls[0]}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open
            </a>
            {outputUrls.length === 1 ? (
              <Button variant="outline" size="sm" onClick={() => triggerBrowserDownload(outputUrls[0]!, 'generated-image-1')}>
                <Download className="h-3.5 w-3.5" /> Download
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-3.5 w-3.5" /> Download
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={handleDownloadAll}>
                    Download all images
                  </DropdownMenuItem>
                  {outputUrls.map((url, index) => (
                    <DropdownMenuItem
                      key={`${url}-download-${index}`}
                      onClick={() => triggerBrowserDownload(url, `generated-image-${index + 1}`)}
                    >
                      Download image {index + 1}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button variant="outline" size="sm" onClick={onNewImage}>New image</Button>
          </div>
          {mode === 'generate' && (
            <button
              onClick={() => onUseAsReference(outputUrls[0]!)}
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
