'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArchiveIcon,
  ArrowLeftIcon,
  DownloadIcon,
  PencilIcon,
  PlusIcon,
  RocketIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FLEX_CATEGORY_LABELS } from '@/features/line-oa/flex/utils';
import { FlexEditor } from '@/features/line-oa/flex/components/flex-editor';
import type { FlexTemplateRecord, FlexCategory } from '@/features/line-oa/flex/types';

const CATEGORIES: FlexCategory[] = ['agriculture', 'ecommerce', 'general', 'alert', 'other'];

type FormState = {
  name: string;
  description: string;
  category: FlexCategory;
  tags: string;
  flexPayload: string;
  altText: string;
};

const emptyForm = (): FormState => ({
  name: '',
  description: '',
  category: 'general',
  tags: '',
  flexPayload: JSON.stringify({ type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [] } }, null, 2),
  altText: '',
});

const toForm = (t: FlexTemplateRecord): FormState => ({
  name: t.name,
  description: t.description ?? '',
  category: t.category,
  tags: t.tags.join(', '),
  flexPayload: JSON.stringify(t.flexPayload, null, 2),
  altText: t.altText,
});

function StatusBadge({ status }: { status: FlexTemplateRecord['catalogStatus'] }) {
  if (status === 'published') return <Badge variant="secondary">Published</Badge>;
  if (status === 'archived') return <Badge variant="outline">Archived</Badge>;
  return <Badge variant="outline">Draft</Badge>;
}

function parsePayload(value: string): Record<string, unknown> | null {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function FlexTemplateEditor({
  template,
  isPending,
  onBack,
  onSubmit,
}: {
  template: FlexTemplateRecord | null;
  isPending: boolean;
  onBack: () => void;
  onSubmit: (form: FormState) => void;
}) {
  const [form, setForm] = useState<FormState>(template ? toForm(template) : emptyForm());
  const isValid = form.name.trim().length > 0 && form.altText.trim().length > 0 && Boolean(parsePayload(form.flexPayload));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={onBack}>
          <ArrowLeftIcon className="size-4" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{template ? 'Edit flex template' : 'New flex template'}</h1>
          {template && <p className="text-sm text-muted-foreground">{template.name}</p>}
        </div>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="my-template"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm((f) => ({ ...f, category: v as FlexCategory }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{FLEX_CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Description</Label>
          <Input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="What this template is for"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Alt text</Label>
          <Input
            value={form.altText}
            onChange={(e) => setForm((f) => ({ ...f, altText: e.target.value }))}
            placeholder="Short notification text (max 400 chars)"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Tags (comma separated)</Label>
          <Input
            value={form.tags}
            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
            placeholder="alert, crop, price"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Flex JSON &amp; Preview</Label>
          <div style={{ height: 520 }}>
            <FlexEditor
              value={form.flexPayload}
              onChange={(v) => setForm((f) => ({ ...f, flexPayload: v }))}
            />
          </div>
          {!parsePayload(form.flexPayload) && form.flexPayload.trim() && (
            <p className="text-xs text-red-600">Invalid JSON</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={onBack}>Cancel</Button>
          <Button onClick={() => onSubmit(form)} disabled={!isValid || isPending}>
            {isPending ? 'Saving…' : template ? 'Save changes' : 'Create template'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminFlexTemplatesPage() {
  const qc = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState<FlexTemplateRecord | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data, isLoading } = useQuery<{ templates: FlexTemplateRecord[] }>({
    queryKey: ['admin', 'flex-templates'],
    queryFn: async () => {
      const res = await fetch('/api/admin/flex-templates');
      if (!res.ok) throw new Error('Failed to load');
      return res.json() as Promise<{ templates: FlexTemplateRecord[] }>;
    },
  });

  const templates = data?.templates ?? [];

  const saveMutation = useMutation({
    mutationFn: async (payload: { id?: string; body: Record<string, unknown> }) => {
      const isEdit = Boolean(payload.id);
      const res = await fetch(
        isEdit ? `/api/admin/flex-templates/${payload.id}` : '/api/admin/flex-templates',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload.body),
        },
      );
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'flex-templates'] });
      setEditingTemplate(null);
      setIsCreating(false);
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/flex-templates/${id}/publish`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'flex-templates'] }),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/flex-templates/${id}/archive`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'flex-templates'] }),
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/flex-templates/seed-agrispark', { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ inserted: number; skipped: number }>;
    },
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'flex-templates'] });
      alert(`Seeded ${result.inserted} templates (${result.skipped} already existed)`);
    },
  });

  const handleSubmit = (form: FormState) => {
    const payload = parsePayload(form.flexPayload);
    if (!payload) return;
    const body = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      flexPayload: payload,
      altText: form.altText.trim(),
    };
    saveMutation.mutate({ id: editingTemplate?.id, body });
  };

  const handleBack = () => {
    setEditingTemplate(null);
    setIsCreating(false);
  };

  if (editingTemplate || isCreating) {
    return (
      <FlexTemplateEditor
        template={editingTemplate}
        isPending={saveMutation.isPending}
        onBack={handleBack}
        onSubmit={handleSubmit}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Flex Templates</h1>
          <p className="text-sm text-muted-foreground">
            Manage platform Flex Message templates. Published templates appear in the user gallery.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
          >
            <DownloadIcon className="size-4" />
            {seedMutation.isPending ? 'Importing…' : 'Import AgriSpark Templates'}
          </Button>
          <Button className="gap-1.5" onClick={() => setIsCreating(true)}>
            <PlusIcon className="size-4" />
            New template
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{templates.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Published</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {templates.filter((t) => t.catalogStatus === 'published').length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Drafts</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {templates.filter((t) => t.catalogStatus === 'draft').length}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3">
        {isLoading ? (
          <Card>
            <CardContent className="py-10 text-sm text-muted-foreground">Loading…</CardContent>
          </Card>
        ) : templates.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-sm text-muted-foreground">
              No flex templates yet. Click &quot;Import AgriSpark Templates&quot; to get started.
            </CardContent>
          </Card>
        ) : (
          templates.map((t) => (
            <Card key={t.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    <StatusBadge status={t.catalogStatus} />
                    <Badge variant="outline">{FLEX_CATEGORY_LABELS[t.category] ?? t.category}</Badge>
                  </div>
                  {t.description && (
                    <p className="text-sm text-muted-foreground">{t.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setEditingTemplate(t)}
                  >
                    <PencilIcon className="size-3.5" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => publishMutation.mutate(t.id)}
                    disabled={publishMutation.isPending}
                  >
                    <RocketIcon className="size-3.5" />
                    {t.catalogStatus === 'published' ? 'Republish' : 'Publish'}
                  </Button>
                  {t.catalogStatus !== 'archived' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => archiveMutation.mutate(t.id)}
                      disabled={archiveMutation.isPending}
                    >
                      <ArchiveIcon className="size-3.5" />
                      Archive
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <span>Alt text: {t.altText}</span>
                {t.tags.length > 0 && (
                  <span className="ml-4">Tags: {t.tags.join(', ')}</span>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
