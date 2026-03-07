import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DefaultChatTransport } from 'ai';
import { useChat } from '@ai-sdk/react';
import type { QueryClient } from '@tanstack/react-query';
import { getTextContentFromParts } from '../utils/message-parts';
import { exportConversation } from '../utils/export-conversation';
import type { ChatMessage, ChatMessagePart } from '../types';
import type { PromptInputMessage } from '@/components/ai-elements/prompt-input';

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
}: UseChatSessionOptions) => {
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
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
        }),
      }),
    [
      activeThreadIdRef,
      selectedModelRef,
      selectedDocIdsRef,
      enabledModelIdsRef,
      useWebSearchRef,
      selectedAgentIdRef,
    ]
  );

  const { messages, sendMessage, setMessages, status, stop, error } = useChat<ChatMessage>({
    transport,
    onFinish: async () => {
      await queryClient.invalidateQueries({ queryKey: ['threads'] });
      await queryClient.invalidateQueries({ queryKey: ['credits'] });
      if (activeThreadId) {
        await queryClient.invalidateQueries({
          queryKey: ['threads', activeThreadId, 'messages'],
        });
      }
    },
  });

  // Sync messages when thread changes (including clearing for new chat)
  useEffect(() => {
    if (prevThreadIdRef.current !== activeThreadId) {
      const prevId = prevThreadIdRef.current;
      prevThreadIdRef.current = activeThreadId;
      // Only abort an in-flight stream when switching between existing threads,
      // not when a new thread is first created ('' → newId).
      if (prevId) stop();
      setMessages(activeThreadId ? activeMessages : []);
    }
  }, [activeThreadId, activeMessages, setMessages, stop]);

  useEffect(() => {
    if (!activeThreadId) {
      return;
    }
    if (messages.length === 0 && activeMessages.length > 0 && status === 'ready') {
      setMessages(activeMessages);
    }
  }, [activeMessages, activeThreadId, messages.length, setMessages, status]);

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
    copiedMessageId,
    copyToClipboard,
    handleSubmitMessage,
    regenerateMessage,
    handleExportConversation,
    handleTranscription,
  };
};
