'use client';

import {
  CalendarIcon,
  FileTextIcon,
  SendIcon,
  SparklesIcon,
  TrendingUpIcon,
  CheckCircleIcon,
  ClockIcon,
  AlertCircleIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePosts } from '@/features/content-marketing/hooks/use-posts';
import { useAccounts } from '@/features/content-marketing/hooks/use-accounts';
import { useCampaignBriefs } from '@/features/content-calendar/hooks/use-calendar';
import { useContentPieces } from '@/features/long-form/hooks/use-content-pieces';

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-500',
  facebook: 'bg-blue-600',
  tiktok: 'bg-zinc-900 dark:bg-zinc-100',
};

type Props = {
  onNavigate: (tab: string) => void;
};

export function HubOverviewTab({ onNavigate }: Props) {
  const { allPosts } = usePosts();
  const { connectedAccounts } = useAccounts();
  const { data: campaigns = [] } = useCampaignBriefs();
  const { data: contentPieces = [] } = useContentPieces();

  const now = new Date();
  const upcomingPosts = allPosts
    .filter((p) => p.status === 'scheduled' && p.scheduledAt && new Date(p.scheduledAt) > now)
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())
    .slice(0, 5);

  const draftPosts = allPosts.filter((p) => p.status === 'draft').length;
  const publishedPosts = allPosts.filter((p) => p.status === 'published').length;

  const activeCampaigns = campaigns.filter((c) => c.status === 'active' || c.status === 'draft');
  const draftPieces = contentPieces.filter((p) => p.status === 'draft').length;
  const publishedPieces = contentPieces.filter((p) => p.status === 'published').length;

  const noAccountsConnected = connectedAccounts.length === 0;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">

      {/* Setup banner */}
      {noAccountsConnected && (
        <div className="flex items-center gap-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
          <AlertCircleIcon className="size-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Connect your social accounts</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Link Instagram, Facebook, or TikTok to start publishing directly from here.</p>
          </div>
          <Button size="sm" variant="outline" className="shrink-0 border-amber-300" onClick={() => onNavigate('settings')}>
            Connect
          </Button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Scheduled posts', value: upcomingPosts.length, icon: <ClockIcon className="size-4" />, color: 'text-blue-500', tab: 'social' },
          { label: 'Draft posts', value: draftPosts, icon: <FileTextIcon className="size-4" />, color: 'text-zinc-500', tab: 'social' },
          { label: 'Published', value: publishedPosts + publishedPieces, icon: <CheckCircleIcon className="size-4" />, color: 'text-green-500', tab: 'measure' },
          { label: 'Campaigns', value: activeCampaigns.length, icon: <TrendingUpIcon className="size-4" />, color: 'text-purple-500', tab: 'plan' },
        ].map(({ label, value, icon, color, tab }) => (
          <button
            key={label}
            type="button"
            onClick={() => onNavigate(tab)}
            className="flex flex-col gap-2 rounded-xl border border-black/5 dark:border-border bg-muted/20 p-4 text-left hover:bg-muted/40 transition-colors"
          >
            <div className={`${color}`}>{icon}</div>
            <p className="text-2xl font-semibold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </button>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Quick actions</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onNavigate('social')}>
            <SparklesIcon className="size-3.5" />
            Create social post
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onNavigate('longform')}>
            <FileTextIcon className="size-3.5" />
            Write long-form
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onNavigate('plan')}>
            <CalendarIcon className="size-3.5" />
            Open calendar
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onNavigate('measure')}>
            <TrendingUpIcon className="size-3.5" />
            View analytics
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Upcoming scheduled posts */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Upcoming posts</p>
            <button type="button" onClick={() => onNavigate('social')} className="text-xs text-primary hover:underline">View all</button>
          </div>
          {upcomingPosts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-5 text-center">
              <ClockIcon className="mx-auto size-6 text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">No scheduled posts yet.</p>
              <button type="button" onClick={() => onNavigate('social')} className="mt-1.5 text-xs text-primary hover:underline">
                Schedule one now
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingPosts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-start gap-3 rounded-lg border border-black/5 dark:border-border bg-muted/20 px-3 py-2.5"
                >
                  <div className="flex gap-1 mt-0.5 shrink-0">
                    {post.platforms.slice(0, 2).map((p) => (
                      <span key={p} className={`inline-block size-2 rounded-full ${PLATFORM_COLORS[p] ?? 'bg-zinc-400'}`} />
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{post.caption.slice(0, 60)}{post.caption.length > 60 ? '…' : ''}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {post.scheduledAt ? new Date(post.scheduledAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">scheduled</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active campaigns */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active campaigns</p>
            <button type="button" onClick={() => onNavigate('plan')} className="text-xs text-primary hover:underline">View all</button>
          </div>
          {activeCampaigns.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-5 text-center">
              <TrendingUpIcon className="mx-auto size-6 text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">No active campaigns.</p>
              <button type="button" onClick={() => onNavigate('plan')} className="mt-1.5 text-xs text-primary hover:underline">
                Create a campaign brief
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {activeCampaigns.slice(0, 4).map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-lg border border-black/5 dark:border-border bg-muted/20 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.title}</p>
                    {c.goal && <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.goal}</p>}
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize shrink-0">{c.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Long-form content pieces */}
      {contentPieces.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent content pieces</p>
            <button type="button" onClick={() => onNavigate('longform')} className="text-xs text-primary hover:underline">View all</button>
          </div>
          <div className="space-y-1.5">
            {contentPieces.slice(0, 3).map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border border-black/5 dark:border-border bg-muted/20 px-3 py-2">
                <FileTextIcon className="size-3.5 text-muted-foreground shrink-0" />
                <p className="truncate text-sm flex-1">{p.title}</p>
                <Badge variant="outline" className="text-[10px] capitalize shrink-0">{p.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
