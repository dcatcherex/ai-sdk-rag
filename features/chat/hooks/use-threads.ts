import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChatMessage, ThreadItem } from '../types';

export const useThreads = () => {
  const queryClient = useQueryClient();
  const [activeThreadId, setActiveThreadId] = useState('');
  const activeThreadIdRef = useRef(activeThreadId);
  activeThreadIdRef.current = activeThreadId;

  const { data: threads = [], isLoading: isThreadsLoading } = useQuery<ThreadItem[]>({
    queryKey: ['threads'],
    queryFn: async () => {
      const response = await fetch('/api/threads');
      if (!response.ok) {
        throw new Error('Failed to load threads');
      }
      const payload = (await response.json()) as { threads: ThreadItem[] };
      return payload.threads;
    },
  });

  const { data: activeMessages = [] } = useQuery<ChatMessage[]>({
    queryKey: ['threads', activeThreadId, 'messages'],
    enabled: Boolean(activeThreadId),
    queryFn: async () => {
      const response = await fetch(`/api/threads/${activeThreadId}/messages`);
      if (!response.ok) {
        throw new Error('Failed to load messages');
      }
      const payload = (await response.json()) as { messages: ChatMessage[] };
      return payload.messages;
    },
  });

  const createThreadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/threads', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to create thread');
      }
      const payload = (await response.json()) as { thread: ThreadItem };
      return payload.thread;
    },
    onSuccess: async (thread: ThreadItem) => {
      queryClient.setQueryData<ThreadItem[]>(
        ['threads'],
        (prev: ThreadItem[] | undefined) => [thread, ...(prev ?? [])]
      );
      setActiveThreadId(thread.id);
      await queryClient.invalidateQueries({ queryKey: ['threads'] });
    },
  });

  const pinThreadMutation = useMutation({
    mutationFn: async ({ threadId, pinned }: { threadId: string; pinned: boolean }) => {
      const response = await fetch(`/api/threads/${threadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned }),
      });
      if (!response.ok) {
        throw new Error('Failed to update thread');
      }
      return { threadId, pinned };
    },
    onMutate: async ({ threadId, pinned }) => {
      await queryClient.cancelQueries({ queryKey: ['threads'] });
      const previous = queryClient.getQueryData<ThreadItem[]>(['threads']);
      queryClient.setQueryData<ThreadItem[]>(['threads'], (prev) =>
        (prev ?? []).map((t) => (t.id === threadId ? { ...t, pinned } : t))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['threads'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['threads'] });
    },
  });

  const deleteThreadMutation = useMutation({
    mutationFn: async (threadId: string) => {
      const response = await fetch(`/api/threads/${threadId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete thread');
      }
      return threadId;
    },
    onSuccess: async (threadId: string) => {
      queryClient.setQueryData<ThreadItem[]>(['threads'], (prev) =>
        (prev ?? []).filter((thread) => thread.id !== threadId)
      );
      setActiveThreadId((prev) => (prev === threadId ? '' : prev));
      await queryClient.invalidateQueries({ queryKey: ['threads'] });
    },
  });

  const activeThread = useMemo(
    () => threads.find((thread: ThreadItem) => thread.id === activeThreadId),
    [activeThreadId, threads]
  );

  // Auto-select first thread
  useEffect(() => {
    if (!activeThreadId && threads.length > 0) {
      setActiveThreadId(threads[0]?.id ?? '');
    }
  }, [threads, activeThreadId]);

  const handleCreateThread = useCallback(() => {
    createThreadMutation.mutate();
  }, [createThreadMutation]);

  const ensureThread = useCallback(async (): Promise<string> => {
    if (activeThreadId) {
      return activeThreadId;
    }
    const response = await fetch('/api/threads', { method: 'POST' });
    if (!response.ok) {
      throw new Error('Failed to create thread');
    }
    const payload = (await response.json()) as { thread: ThreadItem };
    queryClient.setQueryData<ThreadItem[]>(
      ['threads'],
      (prev) => [payload.thread, ...(prev ?? [])]
    );
    activeThreadIdRef.current = payload.thread.id;
    setActiveThreadId(payload.thread.id);
    return payload.thread.id;
  }, [activeThreadId, queryClient]);

  return {
    activeThreadId,
    activeThreadIdRef,
    setActiveThreadId,
    threads,
    isThreadsLoading,
    activeThread,
    activeMessages,
    createThreadMutation,
    pinThreadMutation,
    deleteThreadMutation,
    handleCreateThread,
    ensureThread,
    queryClient,
  };
};
