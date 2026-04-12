'use client';

import Image from 'next/image';
import { useState } from 'react';
import { TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { STATUS_COLORS } from '../../constants';
import { PlatformBadge } from '../platform-badge';
import type { usePosts } from '../../hooks/use-posts';
import type { SocialPostRecord } from '../../types';

type Props = {
  postsState: ReturnType<typeof usePosts>;
  onEdit: (post: SocialPostRecord) => void;
};

type ViewMode = 'card' | 'list';

export function PostsTab({ postsState, onEdit }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const {
    posts,
    postsLoading,
    filterStatus,
    setFilterStatus,
    publishingPostId,
    setPublishingPostId,
    deleteMutation,
    publishMutation,
  } = postsState;

  return (
    <TabsContent value="posts" className="flex-1 overflow-hidden m-0">
      <div className="flex h-full flex-col">

        {/* Toolbar */}
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

          {/* View toggle */}
          <div className="flex rounded-md border overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('card')}
              title="Card view"
              className={`flex h-8 w-8 items-center justify-center text-sm transition-colors ${
                viewMode === 'card'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              ▦
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title="List view"
              className={`flex h-8 w-8 items-center justify-center text-sm transition-colors ${
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              ☰
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {postsLoading && <div className="p-5 text-sm text-muted-foreground">Loading…</div>}
          {!postsLoading && posts.length === 0 && (
            <div className="p-5 text-sm text-muted-foreground italic">No posts yet.</div>
          )}

          {/* Card view */}
          {viewMode === 'card' && (
            <div className="grid grid-cols-2 gap-4 p-5 xl:grid-cols-3">
              {posts.map((post) => (
                <div key={post.id} className="group relative flex flex-col rounded-xl border bg-white dark:bg-zinc-900 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  {/* Media */}
                  {post.media[0] ? (
                    <div className="relative h-40 w-full">
                      <Image
                        src={post.media[0].url}
                        alt="Post media"
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-40 w-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center text-3xl text-muted-foreground/30">
                      ✦
                    </div>
                  )}

                  {/* Body */}
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <p className="text-sm leading-snug line-clamp-3 flex-1">{post.caption}</p>

                    <div className="flex flex-wrap items-center gap-1">
                      <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[post.status] ?? ''}`}>
                        {post.status}
                      </span>
                      {post.platforms.map((p) => <PlatformBadge key={p} platform={p} />)}
                    </div>

                    {post.scheduledAt && (
                      <p className="text-[10px] text-muted-foreground">
                        Scheduled: {new Date(post.scheduledAt).toLocaleString()}
                      </p>
                    )}
                    {post.error && <p className="text-[10px] text-red-500">{post.error}</p>}

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 pt-1 border-t">
                      {post.status !== 'published' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 flex-1 text-xs"
                          disabled={publishingPostId === post.id}
                          onClick={() => {
                            setPublishingPostId(post.id);
                            publishMutation.mutate(post.id);
                          }}
                        >
                          {publishingPostId === post.id ? 'Publishing…' : 'Publish'}
                        </Button>
                      )}
                      <button
                        type="button"
                        onClick={() => onEdit(post)}
                        className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:bg-muted text-sm"
                        title="Edit post"
                      >✏</button>
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(post.id)}
                        className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 text-base"
                        title="Delete post"
                      >×</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* List view */}
          {viewMode === 'list' && (
            <div className="divide-y">
              {posts.map((post) => (
                <div key={post.id} className="flex items-start gap-4 px-5 py-4 group hover:bg-muted/30">
                  {post.media[0] && (
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border">
                      <Image src={post.media[0].url} alt="Post media" fill unoptimized className="object-cover" />
                    </div>
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
                      onClick={() => onEdit(post)}
                      className="hidden group-hover:flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted text-sm"
                      title="Edit post"
                    >✏</button>
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(post.id)}
                      className="hidden group-hover:flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 text-lg"
                    >×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </TabsContent>
  );
}
