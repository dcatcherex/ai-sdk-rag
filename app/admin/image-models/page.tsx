'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircleIcon,
  ImageIcon,
  PencilIcon,
  StarIcon,
  XCircleIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminImageModel {
  id: string;
  name: string;
  description: string;
  provider: string;
  mode: 'generate' | 'edit' | 'both';
  badge?: string;
  costPerGeneration: number;
  hasQuality: boolean;
  hasEnablePro: boolean;
  hasResolution: boolean;
  hasGoogleSearch: boolean;
  hasSeed: boolean;
  aspectRatios: string[];
  pricingTiers?: {
    param: string;
    map: Record<string, number>;
    default: string;
  };
  enabled: boolean;
  isDefault: boolean;
  defaultAspectRatio: string | null;
  defaultQuality: string | null;
  defaultResolution: string | null;
  defaultEnablePro: boolean;
  defaultGoogleSearch: boolean;
  taskDefaults: string[];
  adminNotes: string | null;
  updatedAt: string | null;
}

const TASK_OPTIONS = [
  { value: 'social_post',    label: 'Social Post / Marketing graphic' },
  { value: 'photorealistic', label: 'Photorealistic photo / scene' },
  { value: 'illustration',   label: 'Illustration / art / anime' },
  { value: 'edit',           label: 'Image editing (img-to-img)' },
] as const;

const TASK_LABELS: Record<string, string> = Object.fromEntries(TASK_OPTIONS.map(t => [t.value, t.label]));

// ── Provider badge colors ─────────────────────────────────────────────────────

function ProviderBadge({ provider }: { provider: string }) {
  const colors: Record<string, string> = {
    kie: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    openai: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    qwen: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    xai: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    bytedance: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${colors[provider] ?? 'bg-muted text-muted-foreground'}`}>
      {provider}
    </span>
  );
}

function ModeBadge({ mode }: { mode: string }) {
  if (mode === 'both') return <Badge variant="secondary">gen + edit</Badge>;
  if (mode === 'edit') return <Badge variant="outline">edit</Badge>;
  return <Badge variant="outline">generate</Badge>;
}

// ── Config dialog ─────────────────────────────────────────────────────────────

function ConfigDialog({
  model,
  open,
  onClose,
  onSave,
  saving,
}: {
  model: AdminImageModel;
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<AdminImageModel>) => void;
  saving: boolean;
}) {
  const NONE = '__none__';
  const [defaultAspectRatio, setDefaultAspectRatio] = useState(model.defaultAspectRatio ?? NONE);
  const [defaultQuality, setDefaultQuality] = useState(model.defaultQuality ?? NONE);
  const [defaultResolution, setDefaultResolution] = useState(model.defaultResolution ?? NONE);
  const [defaultEnablePro, setDefaultEnablePro] = useState(model.defaultEnablePro);
  const [defaultGoogleSearch, setDefaultGoogleSearch] = useState(model.defaultGoogleSearch);
  const [taskDefaults, setTaskDefaults] = useState<string[]>(model.taskDefaults ?? []);
  const [adminNotes, setAdminNotes] = useState(model.adminNotes ?? '');

  const toggleTask = (task: string) =>
    setTaskDefaults(prev => prev.includes(task) ? prev.filter(t => t !== task) : [...prev, task]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configure {model.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Aspect ratio */}
          <div className="space-y-1.5">
            <Label>Default aspect ratio</Label>
            <Select value={defaultAspectRatio} onValueChange={setDefaultAspectRatio}>
              <SelectTrigger>
                <SelectValue placeholder="(use model default)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Use model default</SelectItem>
                {model.aspectRatios.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quality (GPT Image) */}
          {model.hasQuality && (
            <div className="space-y-1.5">
              <Label>Default quality</Label>
              <Select value={defaultQuality} onValueChange={setDefaultQuality}>
                <SelectTrigger>
                  <SelectValue placeholder="(use default)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Use default (medium)</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
              {model.pricingTiers && (
                <p className="text-xs text-muted-foreground">
                  Credits: medium={model.pricingTiers.map['medium']}, high={model.pricingTiers.map['high']}
                </p>
              )}
            </div>
          )}

          {/* Resolution (Nano Banana) */}
          {model.hasResolution && (
            <div className="space-y-1.5">
              <Label>Default resolution</Label>
              <Select value={defaultResolution} onValueChange={setDefaultResolution}>
                <SelectTrigger>
                  <SelectValue placeholder="(use default)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Use default (1K)</SelectItem>
                  <SelectItem value="1K">1K</SelectItem>
                  <SelectItem value="2K">2K</SelectItem>
                  <SelectItem value="4K">4K</SelectItem>
                </SelectContent>
              </Select>
              {model.pricingTiers && (
                <p className="text-xs text-muted-foreground">
                  Credits: 1K={model.pricingTiers.map['1K']}, 2K={model.pricingTiers.map['2K']}, 4K={model.pricingTiers.map['4K']}
                </p>
              )}
            </div>
          )}

          {/* Enable Pro (Grok) */}
          {model.hasEnablePro && (
            <div className="flex items-center justify-between">
              <Label>Enable Pro by default</Label>
              <Switch checked={defaultEnablePro} onCheckedChange={setDefaultEnablePro} />
            </div>
          )}

          {/* Google Search (Nano Banana 2) */}
          {model.hasGoogleSearch && (
            <div className="flex items-center justify-between">
              <Label>Enable Google Search by default</Label>
              <Switch checked={defaultGoogleSearch} onCheckedChange={setDefaultGoogleSearch} />
            </div>
          )}

          {/* Task defaults (multi-select) */}
          <div className="space-y-2">
            <Label>Task defaults</Label>
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              {TASK_OPTIONS.map(t => (
                <div key={t.value} className="flex items-center gap-2.5">
                  <Checkbox
                    id={`task-${t.value}`}
                    checked={taskDefaults.includes(t.value)}
                    onCheckedChange={() => toggleTask(t.value)}
                  />
                  <label htmlFor={`task-${t.value}`} className="text-sm cursor-pointer select-none">
                    {t.label}
                  </label>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Agents use the task-default model when the task matches, overriding the global default. A model can cover multiple tasks.
            </p>
          </div>

          {/* Admin notes */}
          <div className="space-y-1.5">
            <Label>Admin notes</Label>
            <Textarea
              value={adminNotes}
              onChange={e => setAdminNotes(e.target.value)}
              placeholder="Testing notes, known issues, etc."
              rows={3}
              className="resize-none text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button
              onClick={() =>
                onSave({
                  defaultAspectRatio: defaultAspectRatio === NONE ? null : defaultAspectRatio,
                  defaultQuality: defaultQuality === NONE ? null : defaultQuality,
                  defaultResolution: defaultResolution === NONE ? null : defaultResolution,
                  defaultEnablePro,
                  defaultGoogleSearch,
                  taskDefaults,
                  adminNotes: adminNotes || null,
                })
              }
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ImageModelsPage() {
  const queryClient = useQueryClient();
  const [editingModel, setEditingModel] = useState<AdminImageModel | null>(null);

  const { data, isLoading } = useQuery<{ models: AdminImageModel[] }>({
    queryKey: ['admin', 'image-models'],
    queryFn: async () => {
      const res = await fetch('/api/admin/image-models');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const patchMutation = useMutation({
    mutationFn: async (payload: Partial<AdminImageModel> & { id: string }) => {
      const res = await fetch('/api/admin/image-models', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'image-models'] });
      void queryClient.invalidateQueries({ queryKey: ['image-models-active'] });
      setEditingModel(null);
    },
  });

  const models = data?.models ?? [];
  const enabledCount = models.filter(m => m.enabled).length;
  const defaultModel = models.find(m => m.isDefault);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Image Generation Models</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enable/disable models, set a default, and pre-configure generation options.
            Changes take effect within 30 seconds.
          </p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <div>{enabledCount} / {models.length} enabled</div>
          {defaultModel && (
            <div className="mt-0.5 text-xs">Default: {defaultModel.name}</div>
          )}
        </div>
      </div>

      {/* Model list */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading models…</div>
      ) : (
        <div className="space-y-2">
          {models.map(model => (
            <div
              key={model.id}
              className={`rounded-lg border bg-card px-4 py-3 transition-opacity ${model.enabled ? '' : 'opacity-50'}`}
            >
              <div className="flex items-start gap-3">
                {/* Left: info */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm">{model.name}</span>
                    <ProviderBadge provider={model.provider} />
                    <ModeBadge mode={model.mode} />
                    {model.badge && (
                      <Badge variant="secondary" className="text-xs">{model.badge}</Badge>
                    )}
                    {model.isDefault && (
                      <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                        <StarIcon className="size-3 fill-current" />
                        Default
                      </span>
                    )}
                    {model.taskDefaults?.map(t => (
                      <span key={t} className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                        {TASK_LABELS[t] ?? t}
                      </span>
                    ))}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{model.description}</p>

                  {/* Pre-configured defaults summary */}
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span>{model.costPerGeneration}cr base</span>
                    {model.defaultAspectRatio && <span>ratio: {model.defaultAspectRatio}</span>}
                    {model.defaultQuality && <span>quality: {model.defaultQuality}</span>}
                    {model.defaultResolution && <span>res: {model.defaultResolution}</span>}
                    {model.defaultEnablePro && <span className="text-orange-500">Pro on</span>}
                    {model.defaultGoogleSearch && <span className="text-blue-500">Search on</span>}
                    {model.adminNotes && (
                      <span className="italic">"{model.adminNotes.slice(0, 40)}{model.adminNotes.length > 40 ? '…' : ''}"</span>
                    )}
                  </div>
                </div>

                {/* Right: actions */}
                <div className="flex shrink-0 items-center gap-2">
                  {/* Set as default */}
                  <Button
                    size="sm"
                    variant={model.isDefault ? 'secondary' : 'outline'}
                    className="h-7 text-xs"
                    disabled={model.isDefault || patchMutation.isPending}
                    onClick={() => patchMutation.mutate({ id: model.id, isDefault: true, enabled: true })}
                    title="Set as default model"
                  >
                    <StarIcon className="size-3" />
                    {model.isDefault ? 'Default' : 'Set default'}
                  </Button>

                  {/* Configure */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setEditingModel(model)}
                  >
                    <PencilIcon className="size-3" />
                    Config
                  </Button>

                  {/* Enable / Disable toggle */}
                  <Button
                    size="sm"
                    variant={model.enabled ? 'outline' : 'default'}
                    className="h-7 min-w-[80px] text-xs"
                    disabled={patchMutation.isPending}
                    onClick={() => patchMutation.mutate({ id: model.id, enabled: !model.enabled })}
                  >
                    {model.enabled ? (
                      <>
                        <XCircleIcon className="size-3" />
                        Disable
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="size-3" />
                        Enable
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Config dialog */}
      {editingModel && (
        <ConfigDialog
          model={editingModel}
          open
          onClose={() => setEditingModel(null)}
          onSave={(data) => patchMutation.mutate({ id: editingModel.id, ...data })}
          saving={patchMutation.isPending}
        />
      )}
    </div>
  );
}
