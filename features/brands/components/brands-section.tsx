'use client';

import { useState } from 'react';
import { Building2Icon } from 'lucide-react';
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
import { BrandCard } from './brand-card';
import { BrandEditorSheet } from './brand-editor-sheet';
import { BrandPreview } from './brand-preview';

type Props = {
  isCreating: boolean;
  onCreatingChange: (v: boolean) => void;
  showImport: boolean;
  onShowImportChange: (v: boolean) => void;
};

export function BrandsSection({ isCreating, onCreatingChange, showImport, onShowImportChange }: Props) {
  const qc = useQueryClient();
  const { data: brands = [], isLoading } = useBrands();
  const deleteMutation = useDeleteBrand();
  const setDefaultMutation = useSetDefaultBrand();
  const importMutation = useImportBrand();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
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
        onShowImportChange(false);
        setImportText('');
        setEditingBrand(created);
      },
      onError: () => setImportError('Import failed. Please try again.'),
    });
  };

  const onSaved = (saved: Brand) => {
    setSelectedId(saved.id);
    onCreatingChange(false);
    setEditingBrand(null);
    void qc.invalidateQueries({ queryKey: brandKeys.all });
  };

  return (
    <section>
      {/* JSON Import panel */}
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
              onClick={() => { onShowImportChange(false); setImportText(''); setImportError(''); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Brands count row */}
      <div className="mb-4 flex items-center gap-2">
        <Building2Icon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Brands</span>
        <Badge variant="secondary" className="text-xs">{brands.length}</Badge>
      </div>

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
        <div className="space-y-5">
          {/* Brand card grid */}
          <div className="flex flex-wrap gap-3">
            {brands.map((b) => (
              <BrandCard
                key={b.id}
                brand={b}
                isSelected={resolvedSelectedId === b.id}
                confirmDelete={confirmDeleteId === b.id}
                isDeleting={deleteMutation.isPending}
                onSelect={() => setSelectedId(b.id)}
                onEdit={() => setEditingBrand(b)}
                onDelete={() => handleDelete(b.id)}
                onRequestDelete={() => {
                  setConfirmDeleteId(b.id);
                  setTimeout(() => setConfirmDeleteId(null), 3000);
                }}
              />
            ))}
          </div>

          {/* Selected brand preview */}
          {selectedBrand && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                {selectedBrand.isDefault ? (
                  <Badge variant="secondary" className="text-xs">Default brand</Badge>
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
        onOpenChange={(open) => { if (!open) onCreatingChange(false); }}
        onSaved={onSaved}
      />
      {editingBrand && (
        <BrandEditorSheet
          brand={editingBrand}
          open={!!editingBrand}
          onOpenChange={(open) => { if (!open) setEditingBrand(null); }}
          onSaved={onSaved}
        />
      )}
    </section>
  );
}
