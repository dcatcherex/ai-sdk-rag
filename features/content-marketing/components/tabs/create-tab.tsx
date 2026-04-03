'use client';

import { TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangleIcon, ShieldCheckIcon, ShieldXIcon } from 'lucide-react';
import { PLATFORMS, TONES } from '../../constants';
import type { useComposer } from '../../hooks/use-composer';
import type { useAccounts } from '../../hooks/use-accounts';
import { useBrands } from '@/features/brands/hooks/use-brands';
import { useCampaignBriefs } from '@/features/content-calendar/hooks/use-calendar';

type ComposerState = ReturnType<typeof useComposer>;
type AccountsState = Pick<ReturnType<typeof useAccounts>, 'isConnected'>;

type Props = {
  composer: ComposerState;
  accounts: AccountsState;
};

const SEVERITY_STYLES = {
  block: 'border-destructive/40 bg-destructive/5 text-destructive',
  warning: 'border-amber-400/40 bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400',
  info: 'border-blue-300/40 bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400',
};

const SEVERITY_ICON = {
  block: <ShieldXIcon className="size-3.5 shrink-0" />,
  warning: <AlertTriangleIcon className="size-3.5 shrink-0" />,
  info: <ShieldCheckIcon className="size-3.5 shrink-0" />,
};

export function CreateTab({ composer, accounts }: Props) {
  const {
    fileInputRef,
    topic, setTopic,
    caption, setCaption,
    selectedPlatforms,
    tone, setTone,
    generatedOverrides,
    activePlatformPreview, setActivePlatformPreview,
    uploadedMedia,
    scheduledAt, setScheduledAt,
    editingPostId,
    brandId, setBrandId,
    campaignId, setCampaignId,
    guardrailResult, setGuardrailResult, showGuardrails, setShowGuardrails,
    guardrailMutation,
    runGuardrailCheck,
    hasBlockingViolation,
    generateMutation,
    saveMutation,
    updateMutation,
    uploadMutation,
    togglePlatform,
    removeMedia,
    cancelEdit,
    activeCaptionForPreview,
    minDatetime,
    canSchedule,
  } = composer;

  const { data: brands = [] } = useBrands();
  const { data: campaigns = [] } = useCampaignBriefs(brandId ? { brandId } : undefined);

  return (
    <TabsContent value="create" className="flex flex-1 overflow-hidden m-0">
      <div className="flex flex-1 overflow-hidden">

        {/* Composer panel */}
        <div className="flex w-[420px] shrink-0 flex-col gap-5 overflow-y-auto border-r p-5">
          {editingPostId && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              Editing post — make your changes and click <strong>Update post</strong>.
            </div>
          )}

          {/* Brand selector */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Brand (optional)</p>
            <Select value={brandId || '__none__'} onValueChange={(v) => { setBrandId(v === '__none__' ? '' : v); setCampaignId(''); }}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="No brand selected" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No brand</SelectItem>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {brandId && (
              <p className="mt-1 text-xs text-muted-foreground">
                Brand voice and guardrails will be applied to caption generation.
              </p>
            )}
          </div>

          {/* Campaign selector — only shown when brand is selected */}
          {brandId && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Campaign (optional)</p>
              <Select value={campaignId || '__none__'} onValueChange={(v) => setCampaignId(v === '__none__' ? '' : v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="No campaign" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No campaign</SelectItem>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Platforms */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Platforms</p>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => togglePlatform(id)}
                  className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                    selectedPlatforms.includes(id)
                      ? 'border-transparent bg-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:border-primary'
                  }`}
                >
                  {label}
                  {accounts.isConnected(id) && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-green-400" />}
                </button>
              ))}
            </div>
          </div>

          {/* Topic */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Topic</p>
            <Textarea
              placeholder="What is this post about?"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          {/* Tone + Generate */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Tone</p>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TONES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="pt-6">
              <Button
                size="sm"
                variant="outline"
                onClick={() => generateMutation.mutate()}
                disabled={!topic.trim() || selectedPlatforms.length === 0 || generateMutation.isPending}
              >
                {generateMutation.isPending ? 'Generating…' : '✨ Generate'}
              </Button>
            </div>
          </div>

          {/* Caption */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Caption</p>
              {brandId && caption.trim() && (
                <button
                  type="button"
                  onClick={runGuardrailCheck}
                  disabled={guardrailMutation.isPending}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  {guardrailMutation.isPending ? 'Checking…' : 'Check guardrails'}
                </button>
              )}
            </div>
            <Textarea
              placeholder="Write your caption, or generate one above…"
              value={caption}
              onChange={(e) => { setCaption(e.target.value); setGuardrailResult(null as never); setShowGuardrails(false); }}
              rows={5}
              className="resize-none text-sm"
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">{caption.length} chars</p>
          </div>

          {/* Guardrail violations */}
          {showGuardrails && guardrailResult && guardrailResult.violations.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium">Brand guardrail check</p>
                <button type="button" onClick={() => setShowGuardrails(false)} className="text-xs text-muted-foreground">dismiss</button>
              </div>
              {guardrailResult.violations.map((v, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs ${SEVERITY_STYLES[v.severity as keyof typeof SEVERITY_STYLES] ?? SEVERITY_STYLES.info}`}
                >
                  {SEVERITY_ICON[v.severity as keyof typeof SEVERITY_ICON]}
                  <div className="min-w-0">
                    <p className="font-medium">{v.title}</p>
                    {v.suggestion && <p className="mt-0.5 opacity-80">{v.suggestion}</p>}
                  </div>
                  <Badge variant="outline" className="ml-auto shrink-0 text-xs capitalize">{v.severity}</Badge>
                </div>
              ))}
              {!hasBlockingViolation && (
                <p className="text-xs text-muted-foreground">No blocking violations — you can still save or schedule.</p>
              )}
            </div>
          )}
          {showGuardrails && guardrailResult && guardrailResult.violations.length === 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-green-300/40 bg-green-50 dark:bg-green-900/10 px-2.5 py-2 text-xs text-green-700 dark:text-green-400">
              <ShieldCheckIcon className="size-3.5" />
              All brand guardrails passed.
            </div>
          )}

          {/* Media upload */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Media</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadMutation.mutate(file);
                e.target.value = '';
              }}
            />
            {uploadedMedia.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {uploadedMedia.map((m) => (
                  <div key={m.r2Key} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.url} alt="Uploaded" className="h-16 w-16 rounded object-cover border" />
                    <button
                      type="button"
                      onClick={() => removeMedia(m.r2Key)}
                      className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white"
                    >×</button>
                  </div>
                ))}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={uploadMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadMutation.isPending ? 'Uploading…' : '+ Upload image / video'}
            </Button>
          </div>

          {/* Schedule picker */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Schedule (optional)</p>
            <Input
              type="datetime-local"
              value={scheduledAt}
              min={minDatetime}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="text-sm"
            />
            {scheduledAt && (
              <p className="mt-1 text-xs text-muted-foreground">
                Will publish automatically on {new Date(scheduledAt).toLocaleString()}
                {campaignId && ' · linked to campaign'}
              </p>
            )}
          </div>

          {/* Action buttons */}
          {editingPostId ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={cancelEdit}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => updateMutation.mutate()}
                disabled={!caption.trim() || selectedPlatforms.length === 0 || updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving…' : 'Update post'}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => saveMutation.mutate(false)}
                disabled={!caption.trim() || selectedPlatforms.length === 0 || saveMutation.isPending || hasBlockingViolation}
              >
                {saveMutation.isPending ? 'Saving…' : 'Save draft'}
              </Button>
              <Button
                className="flex-1"
                onClick={() => saveMutation.mutate(true)}
                disabled={!canSchedule || saveMutation.isPending || hasBlockingViolation}
              >
                Schedule
              </Button>
            </div>
          )}

          {hasBlockingViolation && (
            <p className="text-xs text-destructive text-center">
              Fix the blocking guardrail violation before saving.
            </p>
          )}
        </div>

        {/* Preview panel */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Preview</p>
            <div className="flex gap-2 mb-3">
              {selectedPlatforms.map((p) => {
                const info = PLATFORMS.find((x) => x.id === p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setActivePlatformPreview(p)}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                      activePlatformPreview === p
                        ? `${info?.color ?? 'bg-zinc-500'} text-white`
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {info?.label ?? p}
                  </button>
                );
              })}
            </div>
            <div className="rounded-xl border bg-white dark:bg-zinc-900 p-4 shadow-sm min-h-[220px]">
              {uploadedMedia[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={uploadedMedia[0].url}
                  alt="Post media"
                  className={`mb-3 w-full rounded-lg object-cover ${activePlatformPreview === 'tiktok' ? 'aspect-[9/16] max-h-60' : 'aspect-square max-h-60'}`}
                />
              )}
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {activeCaptionForPreview || (
                  <span className="text-muted-foreground italic">Your caption will appear here…</span>
                )}
              </p>
            </div>
            {Object.keys(generatedOverrides).length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Showing platform-specific caption for {PLATFORMS.find((p) => p.id === activePlatformPreview)?.label}.
              </p>
            )}
          </div>
        </div>
      </div>
    </TabsContent>
  );
}
