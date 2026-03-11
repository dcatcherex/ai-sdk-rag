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
    <div className="space-y-3">
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {templates.map((t) => (
          <div
            key={t.id}
            className={cn(
              'group relative cursor-pointer overflow-hidden rounded-xl border-2 transition-all',
              selectedId === t.id
                ? 'border-indigo-500 ring-2 ring-indigo-300/50 dark:ring-indigo-600/50'
                : 'border-transparent hover:border-zinc-300 dark:hover:border-border',
            )}
            onClick={() => onSelect(t)}
          >
            <div className="relative aspect-4/3 w-full bg-zinc-100 dark:bg-muted">
              {t.thumbnailKey || t.r2Key ? (
                <Image
                  src={`/api/certificate/files?templateId=${encodeURIComponent(t.id)}&variant=thumbnail&v=${encodeURIComponent(t.updatedAt)}`}
                  alt={t.name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-zinc-400">No preview</div>
              )}
            </div>

            {selectedId === t.id && (
              <CheckCircle2 className="absolute right-2 top-2 h-5 w-5 text-indigo-500 drop-shadow" />
            )}

            <div className="px-2 py-1.5">
              <p className="truncate text-xs font-medium text-zinc-700 dark:text-foreground/80">{t.name}</p>
              <p className="text-[10px] text-zinc-400">
                {t.templateType} · {getPrintPresetLabel(t.printSettings.preset)}
              </p>
              <p className="text-[10px] text-zinc-400">
                {t.width}×{t.height}px · {t.fields.length} field{t.fields.length !== 1 ? 's' : ''}
              </p>
            </div>

            <button
              className="absolute left-2 top-2 hidden rounded-full bg-white/90 p-1 text-red-500 shadow transition hover:bg-red-50 group-hover:flex dark:bg-muted/90"
              onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(t.id); }}
              title="Delete template"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
