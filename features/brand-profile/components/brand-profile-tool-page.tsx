'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookMarked, CheckCircle2, Circle, Pencil, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import type { ToolPageProps } from '@/features/tools/registry/page-loaders';
import type { BrandProfileOutput } from '../types';

const FIELD_META: Record<string, { label: string; placeholder: string; required: boolean }> = {
  brand_name:      { label: 'Brand Name',      placeholder: 'e.g. Leather Co',                         required: true },
  products:        { label: 'Products / Services', placeholder: 'e.g. handmade leather bags, wallets', required: true },
  tone:            { label: 'Brand Tone',       placeholder: 'e.g. warm, personal, not corporate',      required: true },
  target_audience: { label: 'Target Audience',  placeholder: 'e.g. women 25-40, Bangkok',               required: true },
  usp:             { label: 'USP',              placeholder: 'e.g. handmade, limited edition',           required: false },
  price_range:     { label: 'Price Range',      placeholder: 'e.g. 800–2,500 THB',                      required: false },
  competitors:     { label: 'Competitors',      placeholder: 'e.g. Brand A, Brand B',                   required: false },
  keywords:        { label: 'Keywords / Hashtags', placeholder: 'e.g. #หนังแท้ #กระเป๋าทำมือ',        required: false },
};

const FIELD_ORDER = ['brand_name', 'products', 'tone', 'target_audience', 'usp', 'price_range', 'competitors', 'keywords'];

export function BrandProfileToolPage({ manifest }: ToolPageProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const { data, isLoading } = useQuery<BrandProfileOutput>({
    queryKey: ['brand-profile'],
    queryFn: async () => {
      const res = await fetch('/api/tools/brand-profile/profile');
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<BrandProfileOutput>;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ field, value }: { field: string; value: string }) => {
      const res = await fetch('/api/tools/brand-profile/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-profile'] });
      setEditing(null);
    },
  });

  const startEdit = (field: string) => {
    setDraft(data?.fields[field] ?? '');
    setEditing(field);
  };

  if (isLoading) {
    return <div className="p-8 text-muted-foreground text-sm">Loading brand profile…</div>;
  }

  const fields = data?.fields ?? {};
  const missingRequired = data?.missingRequired ?? [];
  const isComplete = data?.isComplete ?? false;

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BookMarked className="h-6 w-6" />
            {manifest.title}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{manifest.description}</p>
        </div>
        {isComplete ? (
          <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />Complete</Badge>
        ) : (
          <Badge variant="secondary" className="gap-1"><Circle className="h-3 w-3" />{missingRequired.length} required missing</Badge>
        )}
      </div>

      <div className="space-y-3">
        {FIELD_ORDER.map((field) => {
          const meta = FIELD_META[field]!;
          const value = fields[field];
          const isEditing = editing === field;

          return (
            <div key={field} className="rounded-xl border bg-card p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-1.5">
                  {meta.required ? (
                    <CheckCircle2 className={`h-3.5 w-3.5 ${value ? 'text-green-500' : 'text-muted-foreground'}`} />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  {meta.label}
                  {meta.required && <span className="text-destructive text-xs">*</span>}
                </span>
                {!isEditing && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(field)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-2 pt-1">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={meta.placeholder}
                    rows={2}
                    className="resize-none text-sm"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                      <X className="h-3.5 w-3.5 mr-1" />Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={!draft.trim() || saveMutation.isPending}
                      onClick={() => saveMutation.mutate({ field, value: draft.trim() })}
                    >
                      <Save className="h-3.5 w-3.5 mr-1" />Save
                    </Button>
                  </div>
                </div>
              ) : (
                <p className={`text-sm ${value ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                  {value ?? meta.placeholder}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
