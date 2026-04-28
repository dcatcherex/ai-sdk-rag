'use client';

import { useState } from 'react';
import { CheckIcon, LoaderIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useFlexTemplates } from '../hooks/use-flex-templates';
import { FLEX_CATEGORY_LABELS } from '../utils';
import type { FlexTemplateRecord } from '../types';

type FlexTemplateGalleryProps = {
  selectedId?: string | null;
  onSelect: (template: FlexTemplateRecord) => void;
};

export function FlexTemplateGallery({ selectedId, onSelect }: FlexTemplateGalleryProps) {
  const { data: templates, isLoading } = useFlexTemplates();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const categories = ['all', ...new Set((templates ?? []).map((t) => t.category))];

  const filtered = (templates ?? []).filter((t) => {
    const matchesCategory = activeCategory === 'all' || t.category === activeCategory;
    const matchesSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description ?? '').toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <LoaderIcon className="size-4 animate-spin" />
        Loading templates…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="Search templates…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => (
          <Button
            key={cat}
            variant={activeCategory === cat ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setActiveCategory(cat)}
          >
            {cat === 'all' ? 'All' : (FLEX_CATEGORY_LABELS[cat] ?? cat)}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No templates found.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {filtered.map((template) => {
            const isSelected = selectedId === template.id;
            return (
              <button
                key={template.id}
                onClick={() => onSelect(template)}
                className={[
                  'relative rounded-lg border p-3 text-left transition-colors hover:bg-muted/50',
                  isSelected ? 'border-primary bg-primary/5' : 'border-border',
                ].join(' ')}
              >
                {isSelected && (
                  <div className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-primary">
                    <CheckIcon className="size-3 text-white" />
                  </div>
                )}
                <p className="pr-6 text-sm font-medium leading-tight">{template.name}</p>
                {template.description && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {template.description}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge variant="secondary" className="text-xs">
                    {FLEX_CATEGORY_LABELS[template.category] ?? template.category}
                  </Badge>
                  {template.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
