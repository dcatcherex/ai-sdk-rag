'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Building2Icon,
  DownloadIcon,
  PencilIcon,
  PlusIcon,
  StarIcon,
  Trash2Icon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Brand, BrandImportJson } from '../types';
import { BrandEditorSheet } from './brand-editor-sheet';

export function BrandsSection() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/brands');
      if (res.ok) setBrands((await res.json()) as Brand[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/brands/${id}`, { method: 'DELETE' });
      setBrands((prev) => prev.filter((b) => b.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    await fetch(`/api/brands/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _action: 'setDefault' }),
    });
    setBrands((prev) => prev.map((b) => ({ ...b, isDefault: b.id === id })));
  };

  const handleImport = async () => {
    setImportError('');
    let json: BrandImportJson;
    try {
      json = JSON.parse(importText) as BrandImportJson;
    } catch {
      setImportError('Invalid JSON — check the format and try again.');
      return;
    }
    setIsImporting(true);
    try {
      const res = await fetch('/api/brands/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      });
      if (res.ok) {
        const created = (await res.json()) as Brand;
        setBrands((prev) => [created, ...prev]);
        setShowImport(false);
        setImportText('');
        // Open editor so user can review and continue
        setEditingBrand(created);
      } else {
        setImportError('Import failed. Please try again.');
      }
    } finally {
      setIsImporting(false);
    }
  };

  const onSaved = (saved: Brand) => {
    setBrands((prev) => {
      const idx = prev.findIndex((b) => b.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setIsCreating(false);
    setEditingBrand(null);
  };

  return (
    <section>
      {/* Section header */}
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
      <p className="mb-4 text-sm text-muted-foreground">
        Define brand identity, tone, and assets. Activate a brand in any chat or agent to keep
        all outputs on-brand.
      </p>

      {/* JSON Import area */}
      {showImport && (
        <div className="mb-4 space-y-3 rounded-lg border border-black/10 dark:border-border bg-black/2 dark:bg-white/3 p-4">
          <div>
            <p className="text-sm font-medium">Paste Brand JSON</p>
            <p className="text-xs text-muted-foreground">
              Accepts any JSON with fields like{' '}
              <code className="rounded bg-black/5 dark:bg-white/8 px-1 text-[11px]">
                name, overview, toneOfVoice, brandValues, visualAesthetics, fonts
              </code>
            </p>
          </div>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={'{ "name": "My Brand", "toneOfVoice": ["Professional"], ... }'}
            rows={6}
            className="w-full resize-y rounded border border-black/10 dark:border-border bg-transparent px-2 py-1.5 font-mono text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-black/20 dark:focus:ring-white/20"
          />
          {importError && <p className="text-xs text-destructive">{importError}</p>}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => void handleImport()}
              disabled={isImporting || !importText.trim()}
            >
              {isImporting ? 'Importing…' : 'Import & Edit'}
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

      {/* Brand list */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : brands.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/10 dark:border-border px-6 py-12 text-center">
          <Building2Icon className="mx-auto mb-2 size-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            No brands yet. Create one or import from JSON.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {brands.map((b) => (
            <div
              key={b.id}
              className="relative rounded-xl border border-black/8 dark:border-border bg-white/60 dark:bg-white/3 p-4 transition-colors hover:bg-white/80 dark:hover:bg-white/5"
            >
              <div className="flex items-start gap-3">
                {/* Color swatch / icon */}
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: b.colorPrimary ?? 'hsl(var(--muted))' }}
                >
                  <Building2Icon className="size-5 text-white drop-shadow-sm" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">{b.name}</p>
                    {b.isDefault && (
                      <Badge variant="secondary" className="px-1.5 text-[10px]">
                        Default
                      </Badge>
                    )}
                  </div>
                  {b.industry && (
                    <p className="text-xs text-muted-foreground">{b.industry}</p>
                  )}
                  {b.toneOfVoice.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {b.toneOfVoice.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-black/5 dark:bg-white/8 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                      {b.toneOfVoice.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{b.toneOfVoice.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Card actions */}
              <div className="mt-3 flex items-center gap-1 border-t border-black/5 dark:border-border pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setEditingBrand(b)}
                >
                  <PencilIcon className="mr-1 size-3" />
                  Edit
                </Button>
                {!b.isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => void handleSetDefault(b.id)}
                  >
                    <StarIcon className="mr-1 size-3" />
                    Set default
                  </Button>
                )}
                <div className="ml-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => void handleDelete(b.id)}
                    disabled={deletingId === b.id}
                  >
                    <Trash2Icon className="mr-1 size-3" />
                    {deletingId === b.id ? 'Deleting…' : 'Delete'}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create sheet */}
      <BrandEditorSheet
        brand={null}
        open={isCreating}
        onOpenChange={(open) => { if (!open) setIsCreating(false); }}
        onSaved={onSaved}
      />

      {/* Edit sheet */}
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
