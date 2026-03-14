'use client';

import { useState } from 'react';
import {
  Building2Icon,
  CheckIcon,
  DownloadIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Brand, BrandImportJson } from '../types';
import {
  brandKeys,
  useBrands,
  useDeleteBrand,
  useImportBrand,
  useSetDefaultBrand,
} from '../hooks/use-brands';
import { BrandEditorSheet } from './brand-editor-sheet';
import { BrandPreview } from './brand-preview';

export function BrandsSection() {
  const qc = useQueryClient();
  const { data: brands = [], isLoading } = useBrands();
  const deleteMutation = useDeleteBrand();
  const setDefaultMutation = useSetDefaultBrand();
  const importMutation = useImportBrand();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const resolvedSelectedId =
    selectedId ?? brands.find((b) => b.isDefault)?.id ?? brands[0]?.id ?? null;
  const selectedBrand = brands.find((b) => b.id === resolvedSelectedId) ?? null;

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        if (resolvedSelectedId === id) {
          setSelectedId(brands.find((b) => b.id !== id)?.id ?? null);
        }
        setConfirmDeleteId(null);
      },
    });
  };

  const handleImport = () => {
    setImportError('');
    let json: BrandImportJson;
    try {
      json = JSON.parse(importText) as BrandImportJson;
    } catch {
      setImportError('Invalid JSON — check the format and try again.');
      return;
    }
    importMutation.mutate(json, {
      onSuccess: (created) => {
        setSelectedId(created.id);
        setShowImport(false);
        setImportText('');
        setEditingBrand(created);
      },
      onError: () => setImportError('Import failed. Please try again.'),
    });
  };

  const onSaved = (saved: Brand) => {
    setSelectedId(saved.id);
    setIsCreating(false);
    setEditingBrand(null);
    void qc.invalidateQueries({ queryKey: brandKeys.all });
  };

  return (
    <section>
      {/* Header */}
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2Icon className="size-5 text-muted-foreground" />
          <h3 className="text-base font-semibold">Brands</h3>
          <Badge variant="secondary" className="text-xs">
            {brands.length}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImport((v) => !v)}>
            <DownloadIcon className="mr-1.5 size-3.5" />
            Import JSON
          </Button>
          <Button size="sm" onClick={() => setIsCreating(true)}>
            <PlusIcon className="mr-1.5 size-3.5" />
            New Brand
          </Button>
        </div>
      </div>

      {/* JSON Import */}
      {showImport && (
        <div className="mb-5 space-y-3 rounded-xl border border-black/10 dark:border-border bg-black/2 dark:bg-white/3 p-4">
          <div>
            <p className="text-sm font-medium">Paste Brand JSON</p>
            <p className="text-xs text-muted-foreground">
              Accepts fields like{' '}
              <code className="rounded bg-black/5 dark:bg-white/8 px-1 text-[11px]">
                name, overview, toneOfVoice, brandValues, visualAesthetics, fonts
              </code>
            </p>
          </div>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={'{ "name": "My Brand", "toneOfVoice": ["Professional"], ... }'}
            rows={5}
            className="w-full resize-y rounded-lg border border-black/10 dark:border-border bg-transparent px-3 py-2 font-mono text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-black/20 dark:focus:ring-white/20"
          />
          {importError && <p className="text-xs text-destructive">{importError}</p>}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleImport}
              disabled={importMutation.isPending || !importText.trim()}
            >
              {importMutation.isPending ? 'Importing…' : 'Import & Edit'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowImport(false);
                setImportText('');
                setImportError('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Body */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : brands.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/10 dark:border-border px-6 py-12 text-center">
          <Building2Icon className="mx-auto mb-2 size-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            No brands yet. Create one or import from JSON.
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-4">
          {/* Brand list */}
          <div className="flex w-52 shrink-0 flex-col space-y-1">
            {brands.map((b) => (
              <div
                key={b.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(b.id)}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedId(b.id)}
                className={`group relative cursor-pointer rounded-xl border px-3 py-2.5 transition-colors ${
                  resolvedSelectedId === b.id
                    ? 'border-primary/25 bg-primary/5 dark:bg-primary/8'
                    : 'border-black/5 dark:border-border hover:border-black/10 hover:bg-black/2 dark:hover:bg-white/3'
                }`}
              >
                <div className="flex items-center gap-2.5 pr-10">
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                    style={{ background: b.colors[0]?.hex ?? 'hsl(var(--muted))' }}
                  >
                    <Building2Icon className="size-3.5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight">{b.name}</p>
                    {b.industry && (
                      <p className="truncate text-[11px] text-muted-foreground">{b.industry}</p>
                    )}
                  </div>
                  {b.isDefault && <CheckIcon className="size-3 shrink-0 text-primary" />}
                </div>

                {/* Hover: edit + delete */}
                <div className="absolute right-1.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 group-hover:flex">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingBrand(b);
                    }}
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-black/8 dark:hover:bg-white/10 hover:text-foreground"
                    aria-label="Edit brand"
                  >
                    <PencilIcon className="size-3" />
                  </button>
                  {confirmDeleteId === b.id ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(b.id);
                      }}
                      disabled={deleteMutation.isPending}
                      className="rounded p-1 text-destructive transition-colors hover:bg-destructive/10"
                      aria-label="Confirm delete"
                    >
                      <CheckIcon className="size-3" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(b.id);
                        setTimeout(() => setConfirmDeleteId(null), 3000);
                      }}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-black/8 dark:hover:bg-white/10 hover:text-destructive"
                      aria-label="Delete brand"
                    >
                      <Trash2Icon className="size-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Preview */}
          {selectedBrand && (
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex items-center gap-2">
                {selectedBrand.isDefault ? (
                  <Badge variant="secondary" className="text-xs">
                    Default brand
                  </Badge>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setDefaultMutation.mutate(selectedBrand.id)}
                  >
                    Set as default
                  </Button>
                )}
              </div>
              <BrandPreview brand={selectedBrand} />
            </div>
          )}
        </div>
      )}

      {/* Sheets */}
      <BrandEditorSheet
        brand={null}
        open={isCreating}
        onOpenChange={(open) => {
          if (!open) setIsCreating(false);
        }}
        onSaved={onSaved}
      />
      {editingBrand && (
        <BrandEditorSheet
          brand={editingBrand}
          open={!!editingBrand}
          onOpenChange={(open) => {
            if (!open) setEditingBrand(null);
          }}
          onSaved={onSaved}
        />
      )}
    </section>
  );
}
