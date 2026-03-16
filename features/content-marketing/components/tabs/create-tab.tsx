'use client';

import { TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PLATFORMS, TONES } from '../../constants';
import type { useComposer } from '../../hooks/use-composer';
import type { useAccounts } from '../../hooks/use-accounts';

type ComposerState = ReturnType<typeof useComposer>;
type AccountsState = Pick<ReturnType<typeof useAccounts>, 'isConnected'>;

type Props = {
  composer: ComposerState;
  accounts: AccountsState;
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

  return (
    <TabsContent value="create" className="flex flex-1 overflow-hidden m-0">
      <div className="flex flex-1 overflow-hidden">

        {/* Composer panel */}
        <div className="flex w-[400px] shrink-0 flex-col gap-5 overflow-y-auto border-r p-5">
          {editingPostId && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              Editing post — make your changes and click <strong>Update post</strong>.
            </div>
          )}
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

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Caption</p>
            <Textarea
              placeholder="Write your caption, or generate one above…"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={5}
              className="resize-none text-sm"
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">{caption.length} chars</p>
          </div>

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
                disabled={!caption.trim() || selectedPlatforms.length === 0 || saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Saving…' : 'Save draft'}
              </Button>
              <Button
                className="flex-1"
                onClick={() => saveMutation.mutate(true)}
                disabled={!canSchedule || saveMutation.isPending}
              >
                Schedule
              </Button>
            </div>
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
