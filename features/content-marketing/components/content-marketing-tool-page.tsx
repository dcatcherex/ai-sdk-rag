'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ToolManifest } from '@/features/tools/registry/types';
import type {
  SocialPlatform,
  SocialPostRecord,
  GenerateCaptionsResult,
  SocialAccountRecord,
  PublishResult,
} from '../types';

type Props = { manifest: ToolManifest };

const PLATFORMS: { id: SocialPlatform; label: string; color: string; oauthPlatform: string }[] = [
  { id: 'instagram', label: 'Instagram', color: 'bg-pink-500', oauthPlatform: 'meta' },
  { id: 'facebook', label: 'Facebook', color: 'bg-blue-600', oauthPlatform: 'meta' },
  { id: 'tiktok', label: 'TikTok', color: 'bg-black dark:bg-zinc-800', oauthPlatform: 'tiktok' },
];

const TONES = ['engaging', 'professional', 'casual', 'funny', 'inspirational', 'educational'];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  published: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

function PlatformBadge({ platform }: { platform: SocialPlatform }) {
  const p = PLATFORMS.find((x) => x.id === platform);
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white ${p?.color ?? 'bg-zinc-500'}`}>
      {p?.label ?? platform}
    </span>
  );
}

// ── Mini calendar ─────────────────────────────────────────────────────────────

function MiniCalendar({ posts }: { posts: SocialPostRecord[] }) {
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDow = viewDate.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Map day "YYYY-MM-DD" → posts
  const postsByDay = useMemo(() => {
    const map: Record<string, SocialPostRecord[]> = {};
    for (const post of posts) {
      if (!post.scheduledAt) continue;
      const d = new Date(post.scheduledAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map[key]) map[key] = [];
      map[key].push(post);
    }
    return map;
  }, [posts]);

  const monthName = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const prev = () => setViewDate(new Date(year, month - 1, 1));
  const next = () => setViewDate(new Date(year, month + 1, 1));

  const cells: Array<{ key: string | null; day: number | null }> = [
    ...Array.from({ length: firstDow }, () => ({ key: null, day: null })),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { key, day };
    }),
  ];

  const selectedPosts = selectedDay ? (postsByDay[selectedDay] ?? []) : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button type="button" onClick={prev} className="rounded p-1 hover:bg-muted text-muted-foreground">‹</button>
        <p className="text-sm font-semibold">{monthName}</p>
        <button type="button" onClick={next} className="rounded p-1 hover:bg-muted text-muted-foreground">›</button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 text-center">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="py-1 text-[11px] font-medium text-muted-foreground">{d}</div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7 gap-px text-center">
        {cells.map((cell, i) => {
          if (!cell.key || !cell.day) {
            return <div key={`empty-${i}`} />;
          }
          const hasPosts = !!postsByDay[cell.key];
          const isToday = cell.key === todayKey;
          const isSelected = cell.key === selectedDay;

          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => setSelectedDay(isSelected ? null : cell.key)}
              className={`relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors ${
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : isToday
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'hover:bg-muted'
              }`}
            >
              {cell.day}
              {hasPosts && (
                <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full ${isSelected ? 'bg-primary-foreground' : 'bg-primary'}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day posts */}
      {selectedDay && (
        <div className="mt-2 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {new Date(selectedDay + 'T00:00:00').toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          {selectedPosts.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No scheduled posts</p>
          ) : (
            <div className="space-y-2">
              {selectedPosts.map((post) => (
                <div key={post.id} className="rounded-lg border p-3">
                  <p className="text-xs line-clamp-2 text-foreground">{post.caption}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {post.platforms.map((p) => <PlatformBadge key={p} platform={p} />)}
                    {post.scheduledAt && (
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(post.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ContentMarketingToolPage({ manifest }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected) {
      setNotification({ type: 'success', message: `${connected} account connected!` });
      queryClient.invalidateQueries({ queryKey: ['social-accounts'] });
    } else if (error) {
      setNotification({ type: 'error', message: `Connection failed: ${error.replace(/_/g, ' ')}` });
    }
    if (connected || error) window.history.replaceState({}, '', window.location.pathname);
  }, [searchParams, queryClient]);

  // Composer state
  const [topic, setTopic] = useState('');
  const [caption, setCaption] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(['instagram']);
  const [tone, setTone] = useState('engaging');
  const [generatedOverrides, setGeneratedOverrides] = useState<GenerateCaptionsResult['overrides']>({});
  const [activePlatformPreview, setActivePlatformPreview] = useState<SocialPlatform>('instagram');
  const [uploadedMedia, setUploadedMedia] = useState<Array<{ r2Key: string; url: string; mimeType: string; width?: number; height?: number; sizeBytes?: number }>>([]);
  const [scheduledAt, setScheduledAt] = useState(''); // datetime-local string
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [publishingPostId, setPublishingPostId] = useState<string | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ['social-posts', filterStatus],
    queryFn: async () => {
      const res = await fetch(`/api/tools/content-marketing/posts?status=${filterStatus}`);
      if (!res.ok) throw new Error('Failed to load posts');
      return res.json() as Promise<{ posts: SocialPostRecord[] }>;
    },
  });

  // Always fetch all posts for the calendar (no status filter)
  const { data: allPostsData } = useQuery({
    queryKey: ['social-posts', 'all'],
    queryFn: async () => {
      const res = await fetch('/api/tools/content-marketing/posts?status=all');
      if (!res.ok) throw new Error('Failed to load posts');
      return res.json() as Promise<{ posts: SocialPostRecord[] }>;
    },
  });

  const { data: accountsData } = useQuery({
    queryKey: ['social-accounts'],
    queryFn: async () => {
      const res = await fetch('/api/social/accounts');
      if (!res.ok) throw new Error('Failed to load accounts');
      return res.json() as Promise<{ accounts: SocialAccountRecord[] }>;
    },
  });

  const connectedAccounts = accountsData?.accounts ?? [];
  const posts = postsData?.posts ?? [];
  const allPosts = allPostsData?.posts ?? [];

  // ── Mutations ────────────────────────────────────────────────────────────────

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/tools/content-marketing/generate-captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, platforms: selectedPlatforms, tone }),
      });
      if (!res.ok) throw new Error('Generation failed');
      return res.json() as Promise<GenerateCaptionsResult>;
    },
    onSuccess: (data) => {
      setCaption(data.base);
      setGeneratedOverrides(data.overrides ?? {});
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (schedule: boolean) => {
      const res = await fetch('/api/tools/content-marketing/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption,
          platforms: selectedPlatforms,
          platformOverrides: generatedOverrides,
          media: uploadedMedia,
          scheduledAt: schedule && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
      setCaption('');
      setTopic('');
      setGeneratedOverrides({});
      setUploadedMedia([]);
      setScheduledAt('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (postId: string) => {
      const res = await fetch(`/api/tools/content-marketing/posts?id=${postId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['social-posts'] }),
  });

  const publishMutation = useMutation({
    mutationFn: async (postId: string) => {
      const res = await fetch('/api/tools/content-marketing/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      });
      return res.json() as Promise<{ results: PublishResult[] }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
      setPublishingPostId(null);
    },
    onError: () => setPublishingPostId(null),
  });

  const disconnectMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const res = await fetch(`/api/social/accounts?id=${accountId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Disconnect failed');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['social-accounts'] }),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/tools/content-marketing/upload-media', { method: 'POST', body: form });
      if (!res.ok) throw new Error('Upload failed');
      return res.json() as Promise<{ r2Key: string; url: string; mimeType: string; width?: number; height?: number; sizeBytes?: number }>;
    },
    onSuccess: (media) => setUploadedMedia((prev) => [...prev, media]),
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const togglePlatform = (platform: SocialPlatform) =>
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform],
    );

  const isConnected = (platform: SocialPlatform) =>
    connectedAccounts.some((a) => a.platform === platform && a.isActive);

  const activeCaptionForPreview = generatedOverrides[activePlatformPreview]?.caption ?? caption;

  // Minimum datetime-local value: now + 5 min
  const minDatetime = useMemo(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  }, []);

  const canSchedule = !!scheduledAt && !!caption.trim() && selectedPlatforms.length > 0;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{manifest.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{manifest.description}</p>
        </div>
        {notification && (
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            notification.type === 'success'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
          }`}>
            {notification.message}
            <button type="button" onClick={() => setNotification(null)} className="opacity-60 hover:opacity-100">×</button>
          </div>
        )}
      </div>

      <Tabs defaultValue="create" className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="mx-6 mt-3 w-fit">
          <TabsTrigger value="create">Create</TabsTrigger>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="accounts">
            Accounts
            {connectedAccounts.length > 0 && (
              <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                {connectedAccounts.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Create tab ───────────────────────────────────────────────────── */}
        <TabsContent value="create" className="flex flex-1 overflow-hidden m-0">
          <div className="flex flex-1 overflow-hidden">

            {/* Composer */}
            <div className="flex w-[400px] shrink-0 flex-col gap-5 overflow-y-auto border-r p-5">
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
                      {isConnected(id) && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-green-400" />}
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
                          onClick={() => setUploadedMedia((prev) => prev.filter((x) => x.r2Key !== m.r2Key))}
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
            </div>

            {/* Preview */}
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

        {/* ── Posts tab ────────────────────────────────────────────────────── */}
        <TabsContent value="posts" className="flex-1 overflow-hidden m-0">
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 border-b px-5 py-3">
              <p className="flex-1 text-sm font-medium text-muted-foreground">Filter</p>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 w-32 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['all', 'draft', 'scheduled', 'published', 'failed'].map((s) => (
                    <SelectItem key={s} value={s} className="capitalize text-sm">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 overflow-y-auto divide-y">
              {postsLoading && <div className="p-5 text-sm text-muted-foreground">Loading…</div>}
              {!postsLoading && posts.length === 0 && (
                <div className="p-5 text-sm text-muted-foreground italic">No posts yet.</div>
              )}
              {posts.map((post) => (
                <div key={post.id} className="flex items-start gap-4 px-5 py-4 group hover:bg-muted/30">
                  {post.media[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.media[0].url} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover border" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug line-clamp-2">{post.caption}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[post.status] ?? ''}`}>
                        {post.status}
                      </span>
                      {post.platforms.map((p) => <PlatformBadge key={p} platform={p} />)}
                    </div>
                    {post.scheduledAt && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Scheduled: {new Date(post.scheduledAt).toLocaleString()}
                      </p>
                    )}
                    {post.error && <p className="mt-0.5 text-[11px] text-red-500">{post.error}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {post.status !== 'published' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={publishingPostId === post.id}
                        onClick={() => {
                          setPublishingPostId(post.id);
                          publishMutation.mutate(post.id);
                        }}
                      >
                        {publishingPostId === post.id ? 'Publishing…' : 'Publish now'}
                      </Button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(post.id)}
                      className="hidden group-hover:flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 text-lg"
                    >×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── Calendar tab ─────────────────────────────────────────────────── */}
        <TabsContent value="calendar" className="flex-1 overflow-y-auto m-0 p-6">
          <div className="max-w-sm">
            <MiniCalendar posts={allPosts} />
          </div>
        </TabsContent>

        {/* ── Accounts tab ─────────────────────────────────────────────────── */}
        <TabsContent value="accounts" className="flex-1 overflow-y-auto m-0 p-5">
          <div className="max-w-2xl space-y-6">
            <p className="text-sm text-muted-foreground">
              Connect your social accounts to publish posts directly. Meta connects both Facebook and Instagram.
            </p>

            <div className="space-y-3">
              {(['meta', 'tiktok'] as const).map((oauthPlatform) => {
                const connectedForPlatform = connectedAccounts.filter((a) =>
                  oauthPlatform === 'meta'
                    ? a.platform === 'instagram' || a.platform === 'facebook'
                    : a.platform === 'tiktok',
                );
                const isAnyConnected = connectedForPlatform.length > 0;
                return (
                  <div key={oauthPlatform} className="flex items-center justify-between rounded-xl border p-4">
                    <div>
                      <p className="text-sm font-medium">
                        {oauthPlatform === 'meta' ? 'Meta (Facebook + Instagram)' : 'TikTok'}
                      </p>
                      {isAnyConnected && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {connectedForPlatform.map((a) => a.accountName).join(', ')}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={isAnyConnected ? 'outline' : 'default'}
                      onClick={() => {
                        window.location.href = `/api/social/connect/${oauthPlatform}?returnTo=/tools/content-marketing`;
                      }}
                    >
                      {isAnyConnected ? 'Reconnect' : 'Connect'}
                    </Button>
                  </div>
                );
              })}
            </div>

            {connectedAccounts.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Connected Accounts</p>
                <div className="space-y-2">
                  {connectedAccounts.map((account) => (
                    <div key={account.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${account.isActive ? 'bg-green-500' : 'bg-zinc-400'}`} />
                        <div>
                          <p className="text-sm font-medium">{account.accountName}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {account.platform}{account.accountType && ` · ${account.accountType}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {account.tokenExpiresAt && (
                          <p className="text-[11px] text-muted-foreground">
                            Expires {new Date(account.tokenExpiresAt).toLocaleDateString()}
                          </p>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => disconnectMutation.mutate(account.id)}
                          disabled={disconnectMutation.isPending}
                        >
                          Disconnect
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
