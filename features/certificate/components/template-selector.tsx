'use client';

import Image from 'next/image';
import { CheckCircle2, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPrintPresetLabel } from '@/lib/certificate-print';
import { cn } from '@/lib/utils';
import type { CertificateTemplate } from '../types';
import { useDeleteTemplate } from '../hooks/use-templates';

type Props = {
  templates: CertificateTemplate[];
  selectedId: string | null;
  onSelect: (template: CertificateTemplate) => void;
  onUploadClick: () => void;
};

export function TemplateSelector({ templates, selectedId, onSelect, onUploadClick }: Props) {
  const deleteMutation = useDeleteTemplate();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-foreground/80">Templates</h2>
        <Button size="sm" variant="outline" onClick={onUploadClick}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add template
        </Button>
      </div>

      {templates.length === 0 && (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-zinc-400">
          No templates yet. Upload your first certificate template.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {templates.map((t) => (
          <div
            key={t.id}
            role="button"
            tabIndex={0}
            className={cn(
              'group relative text-left transition-all',
              selectedId === t.id
                ? 'scale-[1.01]'
                : '',
            )}
            onClick={() => onSelect(t)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(t);
              }
            }}
          >
            <div
              className={cn(
                'relative overflow-hidden rounded-[24px] border bg-zinc-50/90 p-4 shadow-sm transition-all dark:bg-muted/40',
                selectedId === t.id
                  ? 'border-indigo-400 shadow-[0_20px_40px_-28px_rgba(79,70,229,0.7)] ring-2 ring-indigo-300/60 dark:border-indigo-500 dark:ring-indigo-500/40'
                  : 'border-zinc-200 hover:border-zinc-300 hover:shadow-[0_18px_36px_-28px_rgba(15,23,42,0.45)] dark:border-border dark:hover:border-zinc-700',
              )}
            >
              <div className="absolute inset-x-5 top-5 h-10 rounded-full bg-white/70 blur-2xl dark:bg-white/5" />

              <div className="relative flex aspect-4/3 items-center justify-center overflow-hidden rounded-[18px] bg-[#ececec] dark:bg-zinc-900/70">
                {t.thumbnailKey || t.r2Key ? (
                  <div className="relative h-full w-full overflow-hidden bg-white shadow-[0_12px_30px_-20px_rgba(15,23,42,0.45)]">
                    <Image
                      src={`/api/certificate/files?templateId=${encodeURIComponent(t.id)}&variant=thumbnail&v=${encodeURIComponent(t.updatedAt)}`}
                      alt={t.name}
                      fill
                      className="object-cover object-top"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center justify-center border border-dashed border-zinc-300 bg-white text-xs text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950/60">
                    No preview
                  </div>
                )}

                {selectedId === t.id && (
                  <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-white text-indigo-500 shadow-sm dark:bg-zinc-950">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                )}
              </div>
            </div>

            <div className="px-2 pt-3">
              <p className="truncate text-base font-medium text-zinc-800 dark:text-zinc-100">{t.name}</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {t.templateType} · {getPrintPresetLabel(t.printSettings.preset)}
              </p>
              <p className="text-sm text-zinc-400 dark:text-zinc-500">
                {t.width}×{t.height}px · {t.fields.length} field{t.fields.length !== 1 ? 's' : ''}
              </p>
            </div>

            <button
              className="absolute left-3 top-3 hidden rounded-full bg-white/95 p-1.5 text-red-500 shadow transition hover:bg-red-50 group-hover:flex dark:bg-zinc-950/90"
              onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(t.id); }}
              title="Delete template"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>

            {selectedId === t.id && (
              <div className="pointer-events-none absolute inset-x-2 bottom-0 h-16 rounded-b-[28px] bg-linear-to-t from-indigo-100/60 to-transparent dark:from-indigo-500/10" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
