'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SocialPostRecord, PublishResult } from '../types';

export function usePosts() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [publishingPostId, setPublishingPostId] = useState<string | null>(null);

  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ['social-posts', filterStatus],
    queryFn: async () => {
      const res = await fetch(`/api/tools/content-marketing/posts?status=${filterStatus}`);
      if (!res.ok) throw new Error('Failed to load posts');
      return res.json() as Promise<{ posts: SocialPostRecord[] }>;
    },
  });

  const { data: allPostsData } = useQuery({
    queryKey: ['social-posts', 'all'],
    queryFn: async () => {
      const res = await fetch('/api/tools/content-marketing/posts?status=all');
      if (!res.ok) throw new Error('Failed to load posts');
      return res.json() as Promise<{ posts: SocialPostRecord[] }>;
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

  return {
    posts: postsData?.posts ?? [],
    allPosts: allPostsData?.posts ?? [],
    postsLoading,
    filterStatus,
    setFilterStatus,
    publishingPostId,
    setPublishingPostId,
    deleteMutation,
    publishMutation,
  };
}
