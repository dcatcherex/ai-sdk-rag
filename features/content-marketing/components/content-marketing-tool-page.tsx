'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ToolManifest } from '@/features/tools/registry/types';
import { useComposer } from '../hooks/use-composer';
import { usePosts } from '../hooks/use-posts';
import { useAccounts } from '../hooks/use-accounts';
import { useTrends } from '../hooks/use-trends';
import { CreateTab } from './tabs/create-tab';
import { PostsTab } from './tabs/posts-tab';
import { CalendarTab } from './tabs/calendar-tab';
import { AccountsTab } from './tabs/accounts-tab';
import { TrendsTab } from './tabs/trends-tab';

type Props = { manifest: ToolManifest };

export function ContentMarketingToolPage({ manifest }: Props) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState('create');
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

  const composer = useComposer();
  const postsState = usePosts();
  const accountsState = useAccounts();
  const trendsState = useTrends({
    setNotification,
    onUseTrend: ({ platform, topic }) => {
      composer.setSelectedPlatforms([platform]);
      composer.setTopic(topic);
      composer.setTone('engaging');
      setActiveTab('create');
    },
  });

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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="mx-6 mt-3 w-fit">
          <TabsTrigger value="create">Create</TabsTrigger>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="accounts">
            Accounts
            {accountsState.connectedAccounts.length > 0 && (
              <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                {accountsState.connectedAccounts.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="trends">
            Trends
            <span className="ml-1.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 text-[10px] font-medium">
              New
            </span>
          </TabsTrigger>
        </TabsList>

        <CreateTab composer={composer} accounts={accountsState} />
        <PostsTab postsState={postsState} />
        <CalendarTab allPosts={postsState.allPosts} />
        <AccountsTab accountsState={accountsState} />
        <TrendsTab trendsState={trendsState} />
      </Tabs>
    </div>
  );
}
