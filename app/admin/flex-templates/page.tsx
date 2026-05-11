'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArchiveIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  DownloadIcon,
  EyeIcon,
  FileJsonIcon,
  FilterIcon,
  LayersIcon,
  PencilIcon,
  PlusIcon,
  RocketIcon,
  SearchIcon,
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
import { cn } from '@/lib/utils';
import { FLEX_CATEGORY_LABELS } from '@/features/line-oa/flex/utils';
import { FlexEditor } from '@/features/line-oa/flex/components/flex-editor';
import { FlexPreview } from '@/features/line-oa/flex/components/flex-preview';
import type { FlexTemplateRecord, FlexCategory, FlexTemplateType } from '@/features/line-oa/flex/types';

const CATEGORIES: FlexCategory[] = ['agriculture', 'ecommerce', 'general', 'alert', 'other'];
const STATUS_FILTERS = ['all', 'published', 'draft', 'archived'] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number];

type FormState = {
  name: string;
  description: string;
  category: FlexCategory;
  tags: string;
  templateType: FlexTemplateType;
  richTemplateKey: string;
  flexPayload: string;
  altText: string;
};

const emptyForm = (): FormState => ({
  name: '',
  description: '',
  category: 'general',
  tags: '',
  templateType: 'line_only',
  richTemplateKey: '',
  flexPayload: JSON.stringify({ type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [] } }, null, 2),
  altText: '',
});

const toForm = (t: FlexTemplateRecord): FormState => ({
  name: t.name,
  description: t.description ?? '',
  category: t.category,
  tags: t.tags.join(', '),
  templateType: t.templateType,
  richTemplateKey: t.richTemplateKey ?? '',
  flexPayload: JSON.stringify(t.flexPayload, null, 2),
  altText: t.altText,
});

type RichTemplateOption = {
  key: string;
  title: string;
};

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

function getPayloadType(payload: Record<string, unknown>) {
  return typeof payload.type === 'string' ? payload.type : 'unknown';
}

function getPayloadCount(payload: Record<string, unknown>) {
  if (payload.type === 'carousel' && Array.isArray(payload.contents)) {
    return `${payload.contents.length} bubbles`;
  }

  return '1 bubble';
}

function formatDate(value: string | null) {
  if (!value) return 'Not published';

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function StatTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof LayersIcon;
}) {
  return (
    <Card className="rounded-lg">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex size-10 items-center justify-center rounded-lg border bg-background">
          <Icon className="size-4 text-primary" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyPreview() {
  return (
    <div className="flex h-[560px] items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground">
      Select a template to preview it.
    </div>
  );
}

function TemplatePreviewPanel({
  template,
  richTemplateOptions,
  onEdit,
  onPublish,
  onArchive,
  isPublishing,
  isArchiving,
}: {
  template: FlexTemplateRecord | null;
  richTemplateOptions: RichTemplateOption[];
  onEdit: (template: FlexTemplateRecord) => void;
  onPublish: (id: string) => void;
  onArchive: (id: string) => void;
  isPublishing: boolean;
  isArchiving: boolean;
}) {
  if (!template) return <EmptyPreview />;

  const linkedTemplate = template.richTemplateKey
    ? richTemplateOptions.find((option) => option.key === template.richTemplateKey) ?? null
    : null;

  return (
    <Card className="overflow-hidden rounded-lg">
      <CardHeader className="space-y-3 border-b p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={template.catalogStatus} />
              <Badge variant="outline">{FLEX_CATEGORY_LABELS[template.category] ?? template.category}</Badge>
              <Badge variant={template.templateType === 'line_override' ? 'default' : 'secondary'}>
                {template.templateType === 'line_override' ? 'LINE override' : 'LINE-only'}
              </Badge>
            </div>
            <CardTitle className="break-words text-lg leading-snug">{template.name}</CardTitle>
          </div>
          <Badge variant="outline" className="shrink-0 gap-1">
            <FileJsonIcon className="size-3" />
            {getPayloadType(template.flexPayload)}
          </Badge>
        </div>

        {template.description && (
          <p className="text-sm leading-relaxed text-muted-foreground">{template.description}</p>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border bg-muted/30 p-2">
            <p className="text-muted-foreground">Structure</p>
            <p className="font-medium">{getPayloadCount(template.flexPayload)}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-2">
            <p className="text-muted-foreground">Published</p>
            <p className="font-medium">{formatDate(template.publishedAt)}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4">
        <div className="h-[520px] overflow-hidden rounded-lg border bg-[#EEF2F0]">
          <FlexPreview payload={template.flexPayload} />
        </div>

        <div className="space-y-2 text-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Alt text</p>
            <p className="break-words">{template.altText}</p>
          </div>
          {template.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {template.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="font-normal">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          {template.richTemplateKey ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Linked rich template</p>
              <p className="break-words">
                {linkedTemplate ? `${linkedTemplate.title} (${linkedTemplate.key})` : template.richTemplateKey}
              </p>
            </div>
          ) : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          <Button variant="outline" className="gap-1.5" onClick={() => onEdit(template)}>
            <PencilIcon className="size-4" />
            Edit
          </Button>
          <Button
            className="gap-1.5"
            onClick={() => onPublish(template.id)}
            disabled={isPublishing}
          >
            <RocketIcon className="size-4" />
            {template.catalogStatus === 'published' ? 'Republish' : 'Publish'}
          </Button>
          {template.catalogStatus !== 'archived' && (
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => onArchive(template.id)}
              disabled={isArchiving}
            >
              <ArchiveIcon className="size-4" />
              Archive
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FlexTemplateEditor({
  template,
  richTemplateOptions,
  isPending,
  onBack,
  onSubmit,
}: {
  template: FlexTemplateRecord | null;
  richTemplateOptions: RichTemplateOption[];
  isPending: boolean;
  onBack: () => void;
  onSubmit: (form: FormState) => void;
}) {
  const [form, setForm] = useState<FormState>(template ? toForm(template) : emptyForm());
  const isValid = form.name.trim().length > 0
    && form.altText.trim().length > 0
    && Boolean(parsePayload(form.flexPayload))
    && (form.templateType === 'line_only' || form.richTemplateKey.trim().length > 0);

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

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Template type</Label>
            <Select
              value={form.templateType}
              onValueChange={(value) => setForm((f) => ({
                ...f,
                templateType: value as FlexTemplateType,
                richTemplateKey: value === 'line_only' ? '' : f.richTemplateKey,
              }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="line_only">LINE-only</SelectItem>
                <SelectItem value="line_override">LINE override</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Linked rich template</Label>
            <Select
              value={form.richTemplateKey || '__none__'}
              onValueChange={(value) => setForm((f) => ({
                ...f,
                richTemplateKey: value === '__none__' ? '' : value,
              }))}
              disabled={form.templateType !== 'line_override'}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No linked template</SelectItem>
                {richTemplateOptions.map((option) => (
                  <SelectItem key={option.key} value={option.key}>{option.title} ({option.key})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
            {isPending ? 'Saving...' : template ? 'Save changes' : 'Create template'}
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
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<FlexCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data, isLoading } = useQuery<{ templates: FlexTemplateRecord[] }>({
    queryKey: ['admin', 'flex-templates'],
    queryFn: async () => {
      const res = await fetch('/api/admin/flex-templates');
      if (!res.ok) throw new Error('Failed to load');
      return res.json() as Promise<{ templates: FlexTemplateRecord[] }>;
    },
  });
  const { data: richTemplateData } = useQuery<{ templates: Array<{ key: string; title: string }> }>({
    queryKey: ['admin', 'rich-message-template-options'],
    queryFn: async () => {
      const res = await fetch('/api/admin/rich-message-templates');
      if (!res.ok) throw new Error('Failed to load rich templates');
      return res.json() as Promise<{ templates: Array<{ key: string; title: string }> }>;
    },
  });

  const templates = data?.templates ?? [];
  const richTemplateOptions = (richTemplateData?.templates ?? []).map((template) => ({
    key: template.key,
    title: template.title,
  }));
  const publishedCount = templates.filter((t) => t.catalogStatus === 'published').length;
  const draftCount = templates.filter((t) => t.catalogStatus === 'draft').length;
  const archivedCount = templates.filter((t) => t.catalogStatus === 'archived').length;
  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return templates.filter((template) => {
      const matchesQuery =
        !query ||
        [
          template.name,
          template.description ?? '',
          template.altText,
          template.category,
          template.richTemplateKey ?? '',
          template.templateType,
          ...template.tags,
        ].some((value) => value.toLowerCase().includes(query));
      const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || template.catalogStatus === statusFilter;

      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [categoryFilter, searchQuery, statusFilter, templates]);
  const selectedTemplate =
    templates.find((template) => template.id === selectedTemplateId) ??
    filteredTemplates[0] ??
    templates[0] ??
    null;

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
      setSelectedTemplateId(null);
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
      templateType: form.templateType,
      richTemplateKey: form.richTemplateKey.trim() || null,
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
        richTemplateOptions={richTemplateOptions}
        isPending={saveMutation.isPending}
        onBack={handleBack}
        onSubmit={handleSubmit}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <EyeIcon className="size-3.5 text-primary" />
            Live LINE preview
          </div>
          <h1 className="text-3xl font-bold tracking-tight">LINE Flex Templates</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Manage LINE-only templates and LINE override payloads. The main cross-channel catalog now lives in Message Templates.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
          >
            <DownloadIcon className="size-4" />
            {seedMutation.isPending ? 'Importing...' : 'Import AgriSpark Templates'}
          </Button>
          <Button className="gap-1.5" onClick={() => setIsCreating(true)}>
            <PlusIcon className="size-4" />
            New template
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Total" value={templates.length} icon={LayersIcon} />
        <StatTile label="Published" value={publishedCount} icon={CheckCircle2Icon} />
        <StatTile label="Drafts" value={draftCount} icon={FileJsonIcon} />
        <StatTile label="Archived" value={archivedCount} icon={ArchiveIcon} />
      </div>

      <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-w-0 space-y-3">
          <Card className="rounded-lg">
            <CardContent className="grid gap-3 p-3 md:grid-cols-[minmax(0,1fr)_170px_150px]">
              <div className="relative min-w-0">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search name, tag, alt text"
                  className="pl-9"
                />
              </div>
              <Select
                value={categoryFilter}
                onValueChange={(value) => setCategoryFilter(value as FlexCategory | 'all')}
              >
                <SelectTrigger>
                  <FilterIcon className="mr-2 size-4 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {FLEX_CATEGORY_LABELS[category]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as StatusFilter)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status === 'all' ? 'All status' : status[0].toUpperCase() + status.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {isLoading ? (
              <Card className="rounded-lg">
                <CardContent className="py-10 text-sm text-muted-foreground">Loading...</CardContent>
              </Card>
            ) : templates.length === 0 ? (
              <Card className="rounded-lg">
                <CardContent className="py-10 text-sm text-muted-foreground">
                  No flex templates yet. Click &quot;Import AgriSpark Templates&quot; to get started.
                </CardContent>
              </Card>
            ) : filteredTemplates.length === 0 ? (
              <Card className="rounded-lg">
                <CardContent className="py-10 text-sm text-muted-foreground">
                  No templates match the current filters.
                </CardContent>
              </Card>
            ) : (
              filteredTemplates.map((template) => {
                const isSelected = selectedTemplate?.id === template.id;

                return (
                  <Card
                    key={template.id}
                    className={cn(
                      'cursor-pointer rounded-lg transition-colors hover:border-primary/50',
                      isSelected && 'border-primary bg-primary/5 shadow-sm',
                    )}
                    onClick={() => setSelectedTemplateId(template.id)}
                  >
                    <CardContent className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="break-words text-base leading-snug">
                            {template.name}
                          </CardTitle>
                          <StatusBadge status={template.catalogStatus} />
                          <Badge variant={template.templateType === 'line_override' ? 'default' : 'secondary'}>
                            {template.templateType === 'line_override' ? 'LINE override' : 'LINE-only'}
                          </Badge>
                          <Badge variant="outline">
                            {FLEX_CATEGORY_LABELS[template.category] ?? template.category}
                          </Badge>
                        </div>
                        {template.description && (
                          <p className="line-clamp-2 text-sm text-muted-foreground">
                            {template.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <FileJsonIcon className="size-3" />
                            {getPayloadType(template.flexPayload)} / {getPayloadCount(template.flexPayload)}
                          </span>
                          <span className="break-words">Alt: {template.altText}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 md:justify-end">
                        <Button
                          variant={isSelected ? 'default' : 'outline'}
                          size="sm"
                          className="gap-1.5"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedTemplateId(template.id);
                          }}
                        >
                          <EyeIcon className="size-3.5" />
                          Preview
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditingTemplate(template);
                          }}
                        >
                          <PencilIcon className="size-3.5" />
                          Edit
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-8 lg:self-start">
          <TemplatePreviewPanel
            template={selectedTemplate}
            richTemplateOptions={richTemplateOptions}
            onEdit={setEditingTemplate}
            onPublish={(id) => publishMutation.mutate(id)}
            onArchive={(id) => archiveMutation.mutate(id)}
            isPublishing={publishMutation.isPending}
            isArchiving={archiveMutation.isPending}
          />
        </aside>
      </div>
    </div>
  );
}
