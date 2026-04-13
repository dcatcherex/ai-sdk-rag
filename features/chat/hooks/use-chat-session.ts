import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DefaultChatTransport } from 'ai';
import { useChat } from '@ai-sdk/react';
import type { QueryClient } from '@tanstack/react-query';
import { getTextContentFromParts } from '../utils/message-parts';
import { exportConversation } from '../utils/export-conversation';
import type { ChatMessage, ChatMessagePart, QuizFollowUpContext } from '../types';
import { getActiveBrandId } from '@/features/brands/components/brand-picker-button';
import type { PromptInputMessage } from '@/components/ai-elements/prompt-input';

const FOLLOW_UP_SYNC_MAX_ATTEMPTS = 15;
const FOLLOW_UP_SYNC_RETRY_DELAY_MS = 500;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchThreadMessages = async (threadId: string): Promise<ChatMessage[]> => {
  const response = await fetch(`/api/threads/${threadId}/messages`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to load messages');
  }

  const payload = (await response.json()) as { messages: ChatMessage[] };
  return payload.messages;
};

type UseChatSessionOptions = {
  activeThreadId: string;
  activeThreadIdRef: React.RefObject<string>;
  selectedModelRef: React.RefObject<string>;
  selectedDocIdsRef: React.RefObject<Set<string>>;
  enabledModelIdsRef: React.RefObject<string[]>;
  useWebSearchRef: React.RefObject<boolean>;
  selectedAgentIdRef: React.RefObject<string | null>;
  activeMessages: ChatMessage[];
  queryClient: QueryClient;
  ensureThread: () => Promise<string>;
  followUpSuggestionsEnabled?: boolean;
  latestQuizContextRef: React.RefObject<QuizFollowUpContext | null>;
};

export const useChatSession = ({
  activeThreadId,
  activeThreadIdRef,
  selectedModelRef,
  selectedDocIdsRef,
  enabledModelIdsRef,
  useWebSearchRef,
  selectedAgentIdRef,
  activeMessages,
  queryClient,
  ensureThread,
  followUpSuggestionsEnabled = true,
  latestQuizContextRef,
}: UseChatSessionOptions) => {
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isSyncingFollowUpSuggestions, setIsSyncingFollowUpSuggestions] = useState(false);
  const prevThreadIdRef = useRef<string>('');

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        body: () => ({
          threadId: activeThreadIdRef.current,
          model: selectedModelRef.current,
          useWebSearch: useWebSearchRef.current,
          selectedDocumentIds: selectedDocIdsRef.current.size > 0
            ? [...selectedDocIdsRef.current]
            : undefined,
          enabledModelIds: enabledModelIdsRef.current,
          agentId: selectedAgentIdRef.current ?? undefined,
          brandId: getActiveBrandId() ?? undefined,
          quizContext: latestQuizContextRef.current ?? undefined,
        }),
      }),
    [
      activeThreadIdRef,
      selectedModelRef,
      selectedDocIdsRef,
      enabledModelIdsRef,
      useWebSearchRef,
      selectedAgentIdRef,
      latestQuizContextRef,
    ]
  );

  const { messages, sendMessage, setMessages, status, stop, error, addToolApprovalResponse } = useChat<ChatMessage>({
    transport,
    onFinish: async () => {
      await queryClient.invalidateQueries({ queryKey: ['threads'] });
      await queryClient.invalidateQueries({ queryKey: ['credits'] });
      // Use ref — activeThreadId in closure may be stale (e.g. '' when thread was just created)
      const threadId = activeThreadIdRef.current;
      if (threadId) {
        await queryClient.invalidateQueries({
          queryKey: ['threads', threadId, 'messages'],
        });
        await queryClient.invalidateQueries({
          queryKey: ['threads', threadId, 'working-memory'],
        });

        if (followUpSuggestionsEnabled) {
          setIsSyncingFollowUpSuggestions(true);
          try {
            await syncFollowUpSuggestions(threadId);
          } finally {
            setIsSyncingFollowUpSuggestions(false);
          }
        }
      }
    },
  });

  const mergeFollowUpSuggestions = useCallback((messagesToMerge: ChatMessage[]) => {
    setMessages((current) => {
      if (current.length === 0) return current;
      let changed = false;
      const updated = current.map((msg) => {
        const dbMsg = messagesToMerge.find((m) => m.id === msg.id);
        if (!dbMsg?.metadata?.followUpSuggestions?.length) return msg;
        if ((msg.metadata as import('../types').ChatMessageMetadata)?.followUpSuggestions?.length) return msg;
        changed = true;
        return {
          ...msg,
          metadata: {
            ...(msg.metadata ?? {}),
            followUpSuggestions: dbMsg.metadata.followUpSuggestions,
          },
        };
      });
      return changed ? updated : current;
    });
  }, [setMessages]);

  const replaceMessagesFromDb = useCallback((messagesToSync: ChatMessage[]) => {
    setMessages(messagesToSync);
  }, [setMessages]);

  const syncFollowUpSuggestions = useCallback(async (threadId: string) => {
    let attempts = 0;
    while (attempts < FOLLOW_UP_SYNC_MAX_ATTEMPTS) {
      try {
        const threadMessages = await fetchThreadMessages(threadId);
        queryClient.setQueryData(['threads', threadId, 'messages'], threadMessages);
        mergeFollowUpSuggestions(threadMessages);

        const lastAssistantMessage = [...threadMessages]
          .reverse()
          .find((message) => message.role === 'assistant');
        const hasFollowUpSuggestions = !!lastAssistantMessage?.metadata?.followUpSuggestions?.length;

        if (hasFollowUpSuggestions) {
          replaceMessagesFromDb(threadMessages);
          return;
        }
      } catch (error) {
        if (attempts === FOLLOW_UP_SYNC_MAX_ATTEMPTS - 1) {
          console.error('Failed to sync follow-up suggestions:', error);
          return;
        }
      }

      attempts++;
      if (attempts < FOLLOW_UP_SYNC_MAX_ATTEMPTS) {
        await delay(FOLLOW_UP_SYNC_RETRY_DELAY_MS);
      }
    }
  }, [mergeFollowUpSuggestions, queryClient, replaceMessagesFromDb]);

  // Sync messages when thread changes (including clearing for new chat)
  useEffect(() => {
    if (prevThreadIdRef.current !== activeThreadId) {
      const prevId = prevThreadIdRef.current;
      prevThreadIdRef.current = activeThreadId;

      if (prevId) {
        // Switching between two real threads — abort stream and sync from DB
        stop();
        setMessages(activeThreadId ? activeMessages : []);
      } else if (!activeThreadId) {
        // Back to "new chat" blank state — clear messages
        setMessages([]);
      }
      // If prevId === '' and we got a new threadId (ensureThread just created one),
      // do NOT touch messages — sendMessage already added the optimistic user bubble.
      // The DB-sync effect below will merge follow-up suggestions once streaming finishes.
    }
  }, [activeThreadId, activeMessages, setMessages, stop]);

  useEffect(() => {
    if (!activeThreadId) {
      setIsSyncingFollowUpSuggestions(false);
      return;
    }
    if (messages.length === 0 && activeMessages.length > 0 && status === 'ready') {
      setMessages(activeMessages);
    }
  }, [activeMessages, activeThreadId, messages.length, setMessages, status]);

  useEffect(() => {
    if (status !== 'ready' || activeMessages.length === 0) {
      return;
    }

    mergeFollowUpSuggestions(activeMessages);
  }, [activeMessages, mergeFollowUpSuggestions, status]);

  const copyToClipboard = useCallback(async (messageId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  }, []);

  const handleSubmitMessage = useCallback(
    async ({ text, files }: PromptInputMessage) => {
      if (text.trim().length === 0 && files.length === 0) {
        return;
      }
      await ensureThread();
      sendMessage({ text, files });
    },
    [ensureThread, sendMessage]
  );

  const regenerateMessage = useCallback(
    (messageId: string) => {
      const messageIndex = messages.findIndex((m) => m.id === messageId);
      if (messageIndex === -1) return;

      const messagesToKeep = messages.slice(0, messageIndex);
      setMessages(messagesToKeep);

      const lastUserMessage = messagesToKeep
        .slice()
        .reverse()
        .find((m) => m.role === 'user');

      if (lastUserMessage) {
        const textParts = getTextContentFromParts(
          lastUserMessage.parts as ChatMessagePart[]
        );
        sendMessage({ text: textParts });
      }
    },
    [messages, setMessages, sendMessage]
  );

  const deleteMessage = useCallback(
    async (messageId: string, partnerMessageId?: string) => {
      const idsToRemove = new Set([messageId, ...(partnerMessageId ? [partnerMessageId] : [])]);
      const snapshot = messages;

      // Optimistically update UI
      setMessages(messages.filter((m) => !idsToRemove.has(m.id)));

      try {
        await fetch(`/api/messages/${messageId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alsoDeleteId: partnerMessageId }),
        });
        if (activeThreadId) {
          await queryClient.invalidateQueries({ queryKey: ['threads', activeThreadId, 'messages'] });
        }
      } catch (err) {
        console.error('Failed to delete message:', err);
        setMessages(snapshot);
      }
    },
    [messages, setMessages, activeThreadId, queryClient]
  );

  const handleExportConversation = useCallback(
    async (format: 'json' | 'markdown') => {
      if (!activeThreadId) {
        return;
      }
      try {
        await exportConversation(activeThreadId, format);
      } catch (exportError) {
        console.error('Export error:', exportError);
      }
    },
    [activeThreadId]
  );

  // Handle voice input transcription
  const handleTranscription = useCallback((transcript: string) => {
    console.log('Transcription:', transcript);
  }, []);

  return {
    messages,
    setMessages,
    status,
    error,
    stop,
    isSyncingFollowUpSuggestions,
    copiedMessageId,
    copyToClipboard,
    handleSubmitMessage,
    regenerateMessage,
    deleteMessage,
    handleExportConversation,
    handleTranscription,
    addToolApprovalResponse,
  };
};
