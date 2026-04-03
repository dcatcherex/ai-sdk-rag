'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useComposer } from '@/features/content-marketing/hooks/use-composer';
import { usePosts } from '@/features/content-marketing/hooks/use-posts';
import { useAccounts } from '@/features/content-marketing/hooks/use-accounts';
import { CreateTab } from '@/features/content-marketing/components/tabs/create-tab';
import { PostsTab } from '@/features/content-marketing/components/tabs/posts-tab';
import type { SocialPlatform } from '@/features/content-marketing/types';

export function HubSocialTab() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState('create');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const composer = useComposer();
  const postsState = usePosts();
  const accountsState = useAccounts();

  // Pre-fill from ?topic=&platform= (set by Trends tab "Use this trend")
  useEffect(() => {
    const topic = searchParams.get('topic');
    const platform = searchParams.get('platform') as SocialPlatform | null;
    if (topic) {
      composer.setTopic(decodeURIComponent(topic));
      composer.setTone('engaging');
      if (platform) composer.setSelectedPlatforms([platform]);
      setActiveTab('create');
      // Clean up params without triggering a navigation
      const url = new URL(window.location.href);
      url.searchParams.delete('topic');
      url.searchParams.delete('platform');
      window.history.replaceState({}, '', url.toString());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // OAuth return notification
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

  return (
    <div className="flex h-full flex-col">
      {notification && (
        <div className={`mx-5 mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
          notification.type === 'success'
            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
        }`}>
          {notification.message}
          <button type="button" onClick={() => setNotification(null)} className="ml-auto opacity-60 hover:opacity-100">×</button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="mx-5 mt-3 w-fit shrink-0">
          <TabsTrigger value="create">Create</TabsTrigger>
          <TabsTrigger value="posts">Posts</TabsTrigger>
        </TabsList>

        <CreateTab composer={composer} accounts={accountsState} />
        <PostsTab
          postsState={postsState}
          onEdit={(post) => {
            composer.loadPost(post);
            setActiveTab('create');
          }}
        />
      </Tabs>
    </div>
  );
}
