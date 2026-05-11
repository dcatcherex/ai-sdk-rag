'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ExternalLinkIcon,
  EyeIcon,
  LayersIcon,
  Link2Icon,
  MessageCircleMoreIcon,
  SearchIcon,
  SparklesIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { buildRichMessageDataSchema } from '@/features/rich-messages/dynamic';
import { renderRichMessage, renderRichMessageTemplate } from '@/features/rich-messages/service';
import { RichMessagePreview } from '@/features/rich-messages/components/rich-message-preview';
import { renderRichMessageForLine } from '@/features/rich-messages/adapters/line';
import { FlexPreview } from '@/features/line-oa/flex/components/flex-preview';
import { buildSimulatorUrl } from '@/features/line-oa/flex/utils';
import type { RichMessageTemplateCatalogEntry } from '@/features/rich-messages/catalog';
import type { RichMessageTemplate } from '@/features/rich-messages/types';
import type { FlexTemplateRecord } from '@/features/line-oa/flex/types';

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
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

function normalizeTemplateSearchText(template: RichMessageTemplateCatalogEntry) {
  return [
    template.key,
    template.title,
    template.category,
    template.intent,
    template.description ?? '',
  ].join(' ').toLowerCase();
}

function buildPreviewTemplate(
  entry: RichMessageTemplateCatalogEntry,
): RichMessageTemplate | null {
  if (entry.source !== 'database' || !entry.schemaDefinition) {
    return null;
  }

  return {
    key: entry.key,
    title: entry.title,
    description: entry.description ?? undefined,
    category: entry.category as RichMessageTemplate['category'],
    intent: entry.intent as RichMessageTemplate['intent'],
    schema: buildRichMessageDataSchema(entry.schemaDefinition),
    supportedChannels: entry.supportedChannels as RichMessageTemplate['supportedChannels'],
    layout: entry.layout as RichMessageTemplate['layout'],
    fallback: entry.fallback ?? undefined,
  };
}

function normalizeFlexTemplateSearchText(template: FlexTemplateRecord) {
  return [
    template.name,
    template.description ?? '',
    template.category,
    template.templateType,
    template.richTemplateKey ?? '',
    template.altText,
    ...template.tags,
  ].join(' ').toLowerCase();
}

export default function AdminRichMessageTemplatesPage() {
  const { data, isLoading, refetch } = useQuery<{ templates: RichMessageTemplateCatalogEntry[]; databaseAvailable?: boolean }>({
    queryKey: ['admin', 'rich-message-templates'],
    queryFn: async () => {
      const res = await fetch('/api/admin/rich-message-templates');
      if (!res.ok) {
        throw new Error('Failed to load rich message templates');
      }
      return res.json() as Promise<{ templates: RichMessageTemplateCatalogEntry[]; databaseAvailable?: boolean }>;
    },
  });
  const { data: flexData, isLoading: flexLoading } = useQuery<{ templates: FlexTemplateRecord[] }>({
    queryKey: ['admin', 'flex-templates'],
    queryFn: async () => {
      const res = await fetch('/api/admin/flex-templates');
      if (!res.ok) {
        throw new Error('Failed to load flex templates');
      }
      return res.json() as Promise<{ templates: FlexTemplateRecord[] }>;
    },
  });
  const templates = data?.templates ?? [];
  const flexTemplates = flexData?.templates ?? [];
  const databaseAvailable = data?.databaseAvailable ?? true;
  const [searchQuery, setSearchQuery] = useState('');
  const [lineSearchQuery, setLineSearchQuery] = useState('');
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>(templates[0]?.key ?? '');
  const [selectedFlexTemplateId, setSelectedFlexTemplateId] = useState<string>(flexTemplates[0]?.id ?? '');
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const selectedTemplate = templates.find((template) => template.key === selectedTemplateKey) ?? templates[0] ?? null;
  const selectedFlexTemplate = flexTemplates.find((template) => template.id === selectedFlexTemplateId) ?? flexTemplates[0] ?? null;
  const [draftJson, setDraftJson] = useState('{}');

  useEffect(() => {
    if (!selectedTemplateKey && templates[0]?.key) {
      setSelectedTemplateKey(templates[0].key);
    }
  }, [selectedTemplateKey, templates]);

  useEffect(() => {
    if (selectedTemplate) {
      setDraftJson(JSON.stringify(selectedTemplate.sampleData, null, 2));
    }
  }, [selectedTemplate?.key]);

  useEffect(() => {
    if (!selectedFlexTemplateId && flexTemplates[0]?.id) {
      setSelectedFlexTemplateId(flexTemplates[0].id);
    }
  }, [selectedFlexTemplateId, flexTemplates]);

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return templates;
    }

    return templates.filter((template) => normalizeTemplateSearchText(template).includes(normalizedQuery));
  }, [searchQuery, templates]);

  const filteredFlexTemplates = useMemo(() => {
    const normalizedQuery = lineSearchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return flexTemplates;
    }

    return flexTemplates.filter((template) => normalizeFlexTemplateSearchText(template).includes(normalizedQuery));
  }, [flexTemplates, lineSearchQuery]);

  const parsedSampleData = parseJsonObject(draftJson);
  const rendered = useMemo(() => {
    if (!selectedTemplate || !parsedSampleData) {
      return null;
    }

    if (selectedTemplate.source === 'database') {
      const template = buildPreviewTemplate(selectedTemplate);
      if (!template) {
        return null;
      }

      return renderRichMessageTemplate(template, {
        data: parsedSampleData,
        channel: 'web',
      });
    }

    return renderRichMessage({
      templateKey: selectedTemplate.key,
      data: parsedSampleData,
      channel: 'web',
    });
  }, [parsedSampleData, selectedTemplate]);

  const renderedInstance = rendered?.ok ? rendered.instance : null;
  const lineMessage = renderedInstance ? renderRichMessageForLine(renderedInstance) : null;
  const linePayload = lineMessage?.contents as Record<string, unknown> | undefined;
  const renderIssues = rendered && !rendered.ok ? rendered.issues ?? [rendered.error] : [];

  const handleSelectTemplate = (template: RichMessageTemplateCatalogEntry) => {
    setSelectedTemplateKey(template.key);
    setDraftJson(JSON.stringify(template.sampleData, null, 2));
  };

  const handleTemplateAction = async (
    action: 'publish' | 'archive' | 'delete',
    template: RichMessageTemplateCatalogEntry,
  ) => {
    if (!template.id || template.source !== 'database') {
      return;
    }

    setActionError(null);
    setPendingAction(action);

    try {
      const endpoint = action === 'delete'
        ? `/api/admin/rich-message-templates/${template.id}`
        : `/api/admin/rich-message-templates/${template.id}/${action}`;
      const method = action === 'delete' ? 'DELETE' : 'POST';
      const res = await fetch(endpoint, { method });
      if (!res.ok) {
        throw new Error(await res.text());
      }

      await refetch();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Template action failed');
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <SparklesIcon className="size-3.5 text-primary" />
            Unified catalog
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Message Templates</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Use one catalog for cross-channel rich templates, linked LINE overrides, and LINE-only assets. Canonical templates stay the source of truth.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/flex-templates">Open LINE Flex editor</Link>
          </Button>
        </div>
      </div>

      {!databaseAvailable ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50/80 p-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
          Database-backed templates are temporarily unavailable on this environment. Built-in templates still load, and DB templates will appear here once migrations are applied cleanly.
        </div>
      ) : null}

      {actionError ? (
        <div className="rounded-lg border border-red-300 bg-red-50/80 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-200">
          {actionError}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Templates" value={templates.length} icon={LayersIcon} />
        <StatTile label="Cross-channel" value={templates.length} icon={SparklesIcon} />
        <StatTile label="LINE override" value={flexTemplates.filter((t) => t.templateType === 'line_override').length} icon={Link2Icon} />
        <StatTile label="LINE-only" value={flexTemplates.filter((t) => t.templateType === 'line_only').length} icon={MessageCircleMoreIcon} />
      </div>

      <Tabs defaultValue="cross-channel" className="space-y-4">
        <TabsList variant="line">
          <TabsTrigger value="cross-channel">Cross-channel</TabsTrigger>
          <TabsTrigger value="line-assets">LINE assets</TabsTrigger>
        </TabsList>

        <TabsContent value="cross-channel" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
            <Card className="rounded-lg">
          <CardHeader className="border-b p-4">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search templates"
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[720px]">
              <div className="space-y-2 p-3">
                {filteredTemplates.map((template) => {
                  const isSelected = selectedTemplate?.key === template.key;

                  return (
                    <button
                      key={template.key}
                      type="button"
                      onClick={() => handleSelectTemplate(template)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'bg-card hover:border-primary/40'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{template.title}</div>
                          <div className="truncate text-xs text-muted-foreground">{template.key}</div>
                        </div>
                        <Badge variant="outline">{template.category}</Badge>
                        <Badge variant={template.source === 'database' ? 'default' : 'secondary'}>{template.source}</Badge>
                        <Badge variant={template.publishedLineOverride ? 'default' : 'secondary'}>
                          {template.publishedLineOverride ? 'LINE override' : 'Cross-channel'}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="outline">{template.status}</Badge>
                      </div>
                      {template.description ? (
                        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {template.description}
                        </p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="rounded-lg">
            <CardHeader className="space-y-3 border-b p-4">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-lg">{selectedTemplate?.title ?? 'Template preview'}</CardTitle>
                {selectedTemplate ? <Badge variant="outline">{selectedTemplate.key}</Badge> : null}
                {selectedTemplate ? <Badge variant="secondary">{selectedTemplate.intent}</Badge> : null}
                {selectedTemplate ? <Badge variant="outline">{selectedTemplate.source}</Badge> : null}
                {selectedTemplate ? <Badge variant="outline">{selectedTemplate.status}</Badge> : null}
                {selectedTemplate?.publishedLineOverride ? <Badge variant="default">LINE override</Badge> : null}
              </div>
              {selectedTemplate?.description ? (
                <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Sample data</div>
                  <div className="text-sm text-muted-foreground">Edit JSON to test the canonical renderer.</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedTemplate?.source === 'database' ? (
                    <>
                      {selectedTemplate.status !== 'published' ? (
                        <Button
                          variant="default"
                          size="sm"
                          disabled={pendingAction !== null}
                          onClick={() => void handleTemplateAction('publish', selectedTemplate)}
                        >
                          {pendingAction === 'publish' ? 'Publishing...' : 'Publish'}
                        </Button>
                      ) : null}
                      {selectedTemplate.status !== 'archived' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pendingAction !== null}
                          onClick={() => void handleTemplateAction('archive', selectedTemplate)}
                        >
                          {pendingAction === 'archive' ? 'Archiving...' : 'Archive'}
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pendingAction !== null}
                        onClick={() => void handleTemplateAction('delete', selectedTemplate)}
                      >
                        {pendingAction === 'delete' ? 'Deleting...' : 'Delete'}
                      </Button>
                    </>
                  ) : null}
                  {selectedTemplate ? (
                    <Button variant="outline" size="sm" onClick={() => setDraftJson(JSON.stringify(selectedTemplate.sampleData, null, 2))}>
                      Reset sample
                    </Button>
                  ) : null}
                </div>
              </div>

              <Textarea
                value={draftJson}
                onChange={(event) => setDraftJson(event.target.value)}
                className="min-h-[220px] font-mono text-xs"
                spellCheck={false}
              />

              {!parsedSampleData && draftJson.trim() ? (
                <p className="text-xs text-red-600">Invalid JSON object</p>
              ) : null}
              {renderIssues.length > 0 ? (
                <div className="rounded-lg border border-red-200 bg-red-50/70 p-3 text-xs text-red-700 dark:border-red-950/60 dark:bg-red-950/20 dark:text-red-200">
                  {renderIssues.join('\n')}
                </div>
              ) : null}
            </CardContent>
              </Card>

              <div className="min-h-[560px]">
                <RichMessagePreview instance={renderedInstance} />
              </div>

              <Card className="rounded-lg">
            <CardHeader className="space-y-3 border-b p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Developer outputs</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Inspect the canonical instance, fallback text, and LINE payload generated from the same template.
                  </p>
                </div>
                {linePayload ? (
                  <a
                    href={buildSimulatorUrl(linePayload)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    Open in LINE Simulator
                    <ExternalLinkIcon className="size-3.5" />
                  </a>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              {selectedTemplate ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">Channels</div>
                    <div className="mt-1 text-sm">{selectedTemplate.supportedChannels.join(', ')}</div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">Category</div>
                    <div className="mt-1 text-sm">{selectedTemplate.category}</div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">Intent</div>
                    <div className="mt-1 text-sm">{selectedTemplate.intent}</div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">Layout</div>
                    <div className="mt-1 text-sm">{selectedTemplate.layoutType}</div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">LINE overrides</div>
                    <div className="mt-1 text-sm">{selectedTemplate.lineOverrideCount ?? 0}</div>
                  </div>
                </div>
              ) : null}

              {selectedTemplate?.publishedLineOverride ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200">
                  Published LINE override: {selectedTemplate.publishedLineOverride.name}
                </div>
              ) : null}

              {selectedTemplate?.source === 'database' ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">Created</div>
                    <div className="mt-1 text-sm">{selectedTemplate.createdAt ?? '-'}</div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">Updated</div>
                    <div className="mt-1 text-sm">{selectedTemplate.updatedAt ?? '-'}</div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">Published</div>
                    <div className="mt-1 text-sm">{selectedTemplate.publishedAt ?? '-'}</div>
                  </div>
                </div>
              ) : null}

              <Tabs defaultValue="fallback" className="w-full">
                <TabsList variant="line">
                  <TabsTrigger value="fallback">Fallback</TabsTrigger>
                  <TabsTrigger value="instance">Instance</TabsTrigger>
                  <TabsTrigger value="line">LINE JSON</TabsTrigger>
                  <TabsTrigger value="layout">Layout</TabsTrigger>
                  <TabsTrigger value="schema">Schema</TabsTrigger>
                </TabsList>

                <TabsContent value="fallback" className="pt-3">
                  <Textarea
                    value={renderedInstance?.fallbackText ?? ''}
                    readOnly
                    className="min-h-[180px] font-mono text-xs"
                  />
                </TabsContent>

                <TabsContent value="instance" className="pt-3">
                  <Textarea
                    value={renderedInstance ? JSON.stringify(renderedInstance, null, 2) : ''}
                    readOnly
                    className="min-h-[260px] font-mono text-xs"
                  />
                </TabsContent>

                <TabsContent value="line" className="pt-3">
                  <Textarea
                    value={linePayload ? JSON.stringify(linePayload, null, 2) : ''}
                    readOnly
                    className="min-h-[260px] font-mono text-xs"
                  />
                </TabsContent>

                <TabsContent value="layout" className="pt-3">
                  <Textarea
                    value={selectedTemplate ? JSON.stringify(selectedTemplate.layout, null, 2) : ''}
                    readOnly
                    className="min-h-[260px] font-mono text-xs"
                  />
                </TabsContent>

                <TabsContent value="schema" className="pt-3">
                  <Textarea
                    value={selectedTemplate?.schemaDefinition ? JSON.stringify(selectedTemplate.schemaDefinition, null, 2) : ''}
                    readOnly
                    className="min-h-[260px] font-mono text-xs"
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="line-assets" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
            <Card className="rounded-lg">
              <CardHeader className="border-b p-4">
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={lineSearchQuery}
                    onChange={(event) => setLineSearchQuery(event.target.value)}
                    placeholder="Search LINE-only or override templates"
                    className="pl-9"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[720px]">
                  <div className="space-y-2 p-3">
                    {flexLoading ? (
                      <div className="rounded-lg border p-3 text-sm text-muted-foreground">Loading LINE assets...</div>
                    ) : filteredFlexTemplates.length === 0 ? (
                      <div className="rounded-lg border p-3 text-sm text-muted-foreground">No LINE assets match this search.</div>
                    ) : (
                      filteredFlexTemplates.map((template) => {
                        const isSelected = selectedFlexTemplate?.id === template.id;

                        return (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => setSelectedFlexTemplateId(template.id)}
                            className={`w-full rounded-lg border p-3 text-left transition-colors ${
                              isSelected
                                ? 'border-primary bg-primary/5 shadow-sm'
                                : 'bg-card hover:border-primary/40'
                            }`}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold">{template.name}</div>
                                <div className="truncate text-xs text-muted-foreground">{template.richTemplateKey ?? template.altText}</div>
                              </div>
                              <Badge variant={template.templateType === 'line_override' ? 'default' : 'secondary'}>
                                {template.templateType === 'line_override' ? 'LINE override' : 'LINE-only'}
                              </Badge>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge variant="outline">{template.catalogStatus}</Badge>
                              <Badge variant="outline">{template.category}</Badge>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="rounded-lg">
                <CardHeader className="space-y-3 border-b p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{selectedFlexTemplate?.name ?? 'LINE asset preview'}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        LINE-specific templates live here as either linked overrides or explicit LINE-only assets.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedFlexTemplate?.richTemplateKey ? (
                        <Badge variant="default">Linked to {selectedFlexTemplate.richTemplateKey}</Badge>
                      ) : (
                        <Badge variant="secondary">LINE-only</Badge>
                      )}
                      {selectedFlexTemplate ? (
                        <Button asChild variant="outline" size="sm">
                          <Link href="/admin/flex-templates">Manage in LINE Flex editor</Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-4">
                  {selectedFlexTemplate ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-lg border bg-muted/20 p-3">
                          <div className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">Type</div>
                          <div className="mt-1 text-sm">{selectedFlexTemplate.templateType === 'line_override' ? 'LINE override' : 'LINE-only'}</div>
                        </div>
                        <div className="rounded-lg border bg-muted/20 p-3">
                          <div className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">Status</div>
                          <div className="mt-1 text-sm">{selectedFlexTemplate.catalogStatus}</div>
                        </div>
                        <div className="rounded-lg border bg-muted/20 p-3">
                          <div className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">Category</div>
                          <div className="mt-1 text-sm">{selectedFlexTemplate.category}</div>
                        </div>
                        <div className="rounded-lg border bg-muted/20 p-3">
                          <div className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">Linked key</div>
                          <div className="mt-1 text-sm">{selectedFlexTemplate.richTemplateKey ?? '-'}</div>
                        </div>
                      </div>

                      <div className="h-[560px] overflow-hidden rounded-lg border bg-[#EEF2F0]">
                        <FlexPreview payload={selectedFlexTemplate.flexPayload} />
                      </div>

                      <Card className="rounded-lg">
                        <CardHeader className="space-y-3 border-b p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <CardTitle className="text-lg">LINE payload</CardTitle>
                              <p className="text-sm text-muted-foreground">
                                Inspect the exact Flex JSON used for LINE-specific delivery.
                              </p>
                            </div>
                            <a
                              href={buildSimulatorUrl(selectedFlexTemplate.flexPayload)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                            >
                              Open in LINE Simulator
                              <ExternalLinkIcon className="size-3.5" />
                            </a>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3 p-4">
                          <div className="rounded-lg border bg-muted/20 p-3">
                            <div className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">Alt text</div>
                            <div className="mt-1 text-sm">{selectedFlexTemplate.altText}</div>
                          </div>
                          <Textarea
                            value={JSON.stringify(selectedFlexTemplate.flexPayload, null, 2)}
                            readOnly
                            className="min-h-[260px] font-mono text-xs"
                          />
                        </CardContent>
                      </Card>
                    </>
                  ) : (
                    <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                      Select a LINE asset to inspect it here.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
