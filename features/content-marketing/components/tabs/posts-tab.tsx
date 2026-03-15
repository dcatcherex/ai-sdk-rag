'use client';

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

type Props = {
  postsState: ReturnType<typeof usePosts>;
};

export function PostsTab({ postsState }: Props) {
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
  );
}
