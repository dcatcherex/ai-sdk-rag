'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SlidersHorizontalIcon, FileTextIcon, CheckIcon, RotateCcwIcon, ChevronDownIcon, ChevronRightIcon, PlusIcon } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { availableModels } from '@/lib/ai';
import { IMAGE_MODEL_CONFIGS } from '@/features/image/types';
import { VIDEO_MODEL_CONFIGS } from '@/features/video/types';
import { KIE_AUDIO_MODELS } from '@/lib/models/kie-audio';

// ── Types ─────────────────────────────────────────────────────────────────────

type ModelSlotsResponse = {
  row: Record<string, string | null> | null;
  resolved: Record<string, string | null>;
};

type SlotField = {
  key: string;
  label: string;
  defaultValue: string | null;
};

type SlotOption = {
  value: string;
  label: string;
  group: string;
};

type PromptTemplate = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  activeVersionId: string | null;
  createdAt: string;
  updatedAt: string;
};

type PromptVersion = {
  id: string;
  templateId: string;
  version: number;
  content: string;
  note: string | null;
  createdAt: string;
  createdBy: string | null;
};

// ── Slot config (display names + defaults) ────────────────────────────────────

const SLOT_FIELDS: SlotField[] = [
  { key: 'chatModel',          label: 'Chat Model',          defaultValue: 'google/gemini-3.1-flash-lite-preview' },
  { key: 'backgroundModel',    label: 'Background Model',    defaultValue: 'google/gemini-2.5-flash-lite' },
  { key: 'optimizerModel',     label: 'Optimizer Model',     defaultValue: 'google/gemini-2.5-flash-lite' },
  { key: 'embeddingModel',     label: 'Embedding Model',     defaultValue: 'mistral/mistral-embed' },
  { key: 'imageModel',         label: 'Image Model',         defaultValue: 'google/gemini-3.1-flash-image-preview' },
  { key: 'ttsModel',           label: 'TTS Model',           defaultValue: 'gemini-3.1-flash-tts-preview' },
  { key: 'transcriptionModel', label: 'Transcription Model', defaultValue: 'gemini-2.5-flash-lite' },
  { key: 'liveModel',          label: 'Live Model',          defaultValue: 'gemini-3.1-flash-live-preview' },
  { key: 'videoModel',         label: 'Video Model',         defaultValue: null },
  { key: 'audioModel',         label: 'Audio Model',         defaultValue: null },
];

const DEFAULT_SENTINEL = '__slot_default__';

function hasCapability(model: { capabilities?: readonly string[] }, capability: string): boolean {
  return model.capabilities?.some((entry) => entry === capability) ?? false;
}

const textModelOptions: SlotOption[] = availableModels
  .filter((model) => hasCapability(model, 'text'))
  .map((model) => ({
    value: model.id,
    label: model.name,
    group: 'Text Models',
  }));

const embeddingModelOptions: SlotOption[] = [
  { value: 'mistral/mistral-embed', label: 'Mistral Embed', group: 'Embedding Models' },
  ...availableModels
    .filter((model) => hasCapability(model, 'embeddings'))
    .map((model) => ({
      value: model.id,
      label: model.name,
      group: 'Embedding Models',
    })),
];

const imageModelOptions: SlotOption[] = [
  ...availableModels
    .filter((model) => hasCapability(model, 'image gen'))
    .map((model) => ({
      value: model.id,
      label: model.name,
      group: 'Platform Image Models',
    })),
  ...IMAGE_MODEL_CONFIGS.map((model) => ({
    value: model.id,
    label: model.name,
    group: 'KIE Image Models',
  })),
];

const ttsModelOptions: SlotOption[] = [
  { value: 'gemini-3.1-flash-tts-preview', label: 'Gemini 3.1 Flash TTS Preview', group: 'TTS Models' },
  ...KIE_AUDIO_MODELS
    .filter((model) => model.capabilities?.includes('speech'))
    .map((model) => ({
      value: model.id,
      label: model.name,
      group: 'Speech Models',
    })),
];

const transcriptionModelOptions: SlotOption[] = textModelOptions.map((model) => ({
  ...model,
  group: 'Transcription-Compatible Models',
}));

const liveModelOptions: SlotOption[] = [
  { value: 'gemini-3.1-flash-live-preview', label: 'Gemini 3.1 Flash Live Preview', group: 'Live Models' },
];

const videoModelOptions: SlotOption[] = VIDEO_MODEL_CONFIGS.map((model) => ({
  value: model.id,
  label: model.name,
  group: 'Video Models',
}));

const audioModelOptions: SlotOption[] = KIE_AUDIO_MODELS.map((model) => ({
  value: model.id,
  label: model.name,
  group: model.capabilities?.includes('speech') ? 'Speech Models' : 'Audio Models',
}));

const slotOptionsByKey: Record<string, SlotOption[]> = {
  chatModel: textModelOptions,
  backgroundModel: textModelOptions,
  optimizerModel: textModelOptions,
  embeddingModel: embeddingModelOptions,
  imageModel: imageModelOptions,
  ttsModel: ttsModelOptions,
  transcriptionModel: transcriptionModelOptions,
  liveModel: liveModelOptions,
  videoModel: videoModelOptions,
  audioModel: audioModelOptions,
};

function dedupeOptions(options: SlotOption[]): SlotOption[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
}

function ensureCurrentOption(options: SlotOption[], currentValue: string | null | undefined): SlotOption[] {
  if (!currentValue || options.some((option) => option.value === currentValue)) {
    return dedupeOptions(options);
  }

  return dedupeOptions([
    { value: currentValue, label: `${currentValue} (current custom value)`, group: 'Current Value' },
    ...options,
  ]);
}

function groupOptions(options: SlotOption[]): Array<{ label: string; options: SlotOption[] }> {
  const groups = new Map<string, SlotOption[]>();
  for (const option of options) {
    const existing = groups.get(option.group) ?? [];
    existing.push(option);
    groups.set(option.group, existing);
  }
  return Array.from(groups.entries()).map(([label, groupedOptions]) => ({ label, options: groupedOptions }));
}

// ── Model Slots Panel ─────────────────────────────────────────────────────────

function ModelSlotsPanel() {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery<ModelSlotsResponse>({
    queryKey: ['admin', 'ai-config', 'slots'],
    queryFn: async () => {
      const res = await fetch('/api/admin/ai-config/slots');
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async (payload: Record<string, string | null>) => {
      const res = await fetch('/api/admin/ai-config/slots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'ai-config', 'slots'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setValues({});
    },
  });

  const getDisplayValue = (key: string) => {
    if (key in values) return values[key] ?? '';
    return data?.row?.[key] ?? '';
  };

  const handleSave = () => {
    const payload: Record<string, string | null> = {};
    for (const field of SLOT_FIELDS) {
      const val = getDisplayValue(field.key).trim();
      payload[field.key] = val === '' ? null : val;
    }
    mutation.mutate(payload);
  };

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SLOT_FIELDS.map((field) => {
          const resolved = data?.resolved?.[field.key];
          const isOverridden = Boolean(data?.row?.[field.key]);
          const rawValue = getDisplayValue(field.key);
          const options = ensureCurrentOption(slotOptionsByKey[field.key] ?? [], rawValue);
          const groupedOptions = groupOptions(options);
          const selectValue = rawValue || DEFAULT_SENTINEL;
          return (
            <div key={field.key} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label htmlFor={field.key} className="text-sm font-medium">{field.label}</Label>
                {isOverridden && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">custom</Badge>
                )}
              </div>
              <Select
                value={selectValue}
                onValueChange={(value) => {
                  setValues((prev) => ({
                    ...prev,
                    [field.key]: value === DEFAULT_SENTINEL ? '' : value,
                  }));
                }}
              >
                <SelectTrigger id={field.key} className="w-full">
                  <SelectValue placeholder={field.defaultValue ?? 'not set (optional)'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_SENTINEL}>
                    {field.defaultValue ? `Use default (${field.defaultValue})` : 'Not set (optional)'}
                  </SelectItem>
                  {groupedOptions.map((group) => (
                    <SelectGroup key={group.label}>
                      <SelectLabel>{group.label}</SelectLabel>
                      {group.options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              {resolved && !rawValue && (
                <p className="text-xs text-muted-foreground">Resolved: {resolved}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button
          onClick={handleSave}
          disabled={mutation.isPending}
          size="sm"
        >
          {saved ? (
            <><CheckIcon className="mr-1.5 h-3.5 w-3.5" />Saved</>
          ) : mutation.isPending ? 'Saving...' : 'Save Slots'}
        </Button>
        {mutation.isError && (
          <p className="text-sm text-destructive">{String(mutation.error)}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Leave blank to use hardcoded defaults. Changes take effect within 60 s.
        </p>
      </div>
    </div>
  );
}

// ── Prompt Version History ────────────────────────────────────────────────────

function VersionHistory({
  templateKey,
  activeVersionId,
  onRollback,
}: {
  templateKey: string;
  activeVersionId: string | null;
  onRollback: () => void;
}) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ template: PromptTemplate; versions: PromptVersion[] }>({
    queryKey: ['admin', 'ai-config', 'prompts', templateKey, 'versions'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/ai-config/prompts/${encodeURIComponent(templateKey)}/versions`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: async (versionId: string) => {
      const res = await fetch(`/api/admin/ai-config/prompts/${encodeURIComponent(templateKey)}/versions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'ai-config', 'prompts'] });
      onRollback();
    },
  });

  if (isLoading) return <div className="text-xs text-muted-foreground py-2">Loading history...</div>;

  const versions = data?.versions ?? [];

  return (
    <div className="space-y-1.5 mt-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Version History</p>
      {versions.map((v) => {
        const isActive = v.id === activeVersionId;
        return (
          <div
            key={v.id}
            className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-sm ${
              isActive ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/30'
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">v{v.version}</span>
                {isActive && <Badge className="text-xs px-1.5 py-0 h-4">active</Badge>}
                <span className="text-xs text-muted-foreground">
                  {new Date(v.createdAt).toLocaleDateString()}
                </span>
              </div>
              {v.note && <p className="text-xs text-muted-foreground mt-0.5 truncate">{v.note}</p>}
            </div>
            {!isActive && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs shrink-0"
                onClick={() => rollbackMutation.mutate(v.id)}
                disabled={rollbackMutation.isPending}
              >
                <RotateCcwIcon className="mr-1 h-3 w-3" />
                Restore
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Prompt Template Card ──────────────────────────────────────────────────────

function PromptTemplateCard({ template }: { template: PromptTemplate }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editNote, setEditNote] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: detail } = useQuery<{ template: PromptTemplate; versions: PromptVersion[] }>({
    queryKey: ['admin', 'ai-config', 'prompts', template.key, 'versions'],
    enabled: expanded,
    queryFn: async () => {
      const res = await fetch(`/api/admin/ai-config/prompts/${encodeURIComponent(template.key)}/versions`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const activeVersion = detail?.versions.find((v) => v.id === template.activeVersionId)
    ?? detail?.versions[0];

  const saveMutation = useMutation({
    mutationFn: async (payload: { content: string; note: string }) => {
      const res = await fetch(`/api/admin/ai-config/prompts/${encodeURIComponent(template.key)}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'ai-config', 'prompts'] });
      setEditing(false);
      setEditContent('');
      setEditNote('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const handleEditStart = () => {
    setEditContent(activeVersion?.content ?? '');
    setEditNote('');
    setEditing(true);
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronDownIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{template.name}</span>
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{template.key}</code>
            {saved && <Badge variant="secondary" className="text-xs px-1.5 py-0">saved</Badge>}
          </div>
          {template.description && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{template.description}</p>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
          {editing ? (
            <div className="space-y-3">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="font-mono text-xs min-h-64 resize-y"
                placeholder="System prompt content..."
              />
              <div className="space-y-1.5">
                <Label className="text-xs">Change note (optional)</Label>
                <Input
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="What changed and why..."
                  className="text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => saveMutation.mutate({ content: editContent, note: editNote })}
                  disabled={saveMutation.isPending || !editContent.trim()}
                >
                  {saveMutation.isPending ? 'Saving...' : 'Save New Version'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                {saveMutation.isError && (
                  <span className="text-xs text-destructive">{String(saveMutation.error)}</span>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Active Content
                    {activeVersion && <span className="ml-2 normal-case font-normal">(v{activeVersion.version})</span>}
                  </span>
                  <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={handleEditStart}>
                    Edit
                  </Button>
                </div>
                <pre className="text-xs text-foreground whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                  {activeVersion?.content ?? <span className="text-muted-foreground italic">No active version</span>}
                </pre>
              </div>

              <button
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowHistory((v) => !v)}
              >
                {showHistory ? <ChevronDownIcon className="h-3.5 w-3.5" /> : <ChevronRightIcon className="h-3.5 w-3.5" />}
                Version history ({detail?.versions.length ?? 0})
              </button>

              {showHistory && (
                <VersionHistory
                  templateKey={template.key}
                  activeVersionId={template.activeVersionId}
                  onRollback={() => {
                    queryClient.invalidateQueries({ queryKey: ['admin', 'ai-config', 'prompts'] });
                  }}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── New Template Form ─────────────────────────────────────────────────────────

function NewTemplateForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/ai-config/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, name, content, note: note || undefined }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      setOpen(false);
      setKey(''); setName(''); setContent(''); setNote('');
      onCreated();
    },
  });

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
        New Template
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 space-y-3">
      <p className="text-sm font-medium">New Prompt Template</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Key (unique identifier)</Label>
          <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="feature.prompt-name" className="font-mono text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Display name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Human-readable name" className="text-sm" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Initial content</Label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Prompt content..."
          className="font-mono text-xs min-h-32 resize-y"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Note (optional)</Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Initial version" className="text-sm" />
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !key.trim() || !name.trim() || !content.trim()}
        >
          {mutation.isPending ? 'Creating...' : 'Create'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        {mutation.isError && <span className="text-xs text-destructive">{String(mutation.error)}</span>}
      </div>
    </div>
  );
}

// ── Prompt Templates Panel ────────────────────────────────────────────────────

function PromptTemplatesPanel() {
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery<PromptTemplate[]>({
    queryKey: ['admin', 'ai-config', 'prompts'],
    queryFn: async () => {
      const res = await fetch('/api/admin/ai-config/prompts');
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {templates.length} template{templates.length !== 1 ? 's' : ''}. Changes take effect within 60 s.
        </p>
        <NewTemplateForm onCreated={() => queryClient.invalidateQueries({ queryKey: ['admin', 'ai-config', 'prompts'] })} />
      </div>
      {templates.map((t) => (
        <PromptTemplateCard key={t.id} template={t} />
      ))}
      {templates.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-8">No templates yet.</div>
      )}
    </div>
  );
}

// ── Page root ─────────────────────────────────────────────────────────────────

export function AiConfigPage() {
  return (
    <>
      <PageHeader
        title="AI Configuration"
        description="Manage model slots and prompt templates. Changes apply within 60 s without redeploying."
        icon={<SlidersHorizontalIcon className="h-5 w-5" />}
      />
      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="slots" className="h-full">
          <div className="border-b border-black/5 dark:border-border px-6">
            <TabsList className="h-10 rounded-none bg-transparent p-0 gap-4">
              <TabsTrigger
                value="slots"
                className="rounded-none border-b-2 border-transparent px-0 pb-2 pt-2 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                <SlidersHorizontalIcon className="mr-1.5 h-3.5 w-3.5" />
                Model Slots
              </TabsTrigger>
              <TabsTrigger
                value="prompts"
                className="rounded-none border-b-2 border-transparent px-0 pb-2 pt-2 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                <FileTextIcon className="mr-1.5 h-3.5 w-3.5" />
                Prompt Templates
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="slots" className="mt-0">
            <ModelSlotsPanel />
          </TabsContent>
          <TabsContent value="prompts" className="mt-0">
            <PromptTemplatesPanel />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
