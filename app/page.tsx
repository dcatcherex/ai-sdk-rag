'use client';

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageToolbar,
} from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputBody,
  PromptInputSubmit,
  PromptInputTextarea,
} from '@/components/ai-elements/prompt-input';
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorLogoGroup,
  ModelSelectorName,
  ModelSelectorTrigger,
} from '@/components/ai-elements/model-selector';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { SpeechInput } from '@/components/ai-elements/speech-input';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckIcon, CopyIcon, PlusIcon, RefreshCwIcon, SparklesIcon, Trash2Icon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessagePartRenderer } from '@/components/message-renderer';
import { TokenUsageDisplay } from '@/components/token-usage-display';

type ThreadItem = {
  id: string;
  title: string;
  preview: string;
  updatedAtMs: number;
};

const formatRelativeTime = (timestamp: number) => {
  const diffMs = Date.now() - timestamp;
  if (diffMs < 60 * 1000) {
    return 'Just now';
  }
  if (diffMs < 60 * 60 * 1000) {
    return `${Math.floor(diffMs / (60 * 1000))}m ago`;
  }
  if (diffMs < 24 * 60 * 60 * 1000) {
    return `${Math.floor(diffMs / (60 * 60 * 1000))}h ago`;
  }

  return `${Math.floor(diffMs / (24 * 60 * 60 * 1000))}d ago`;
};

// Available AI models
const AVAILABLE_MODELS = [
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google' as const,
    description: 'Fast and efficient model',
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'openai' as const,
    description: 'Most capable GPT-4 model',
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic' as const,
    description: 'Balanced performance and speed',
  },
];

export default function Chat() {
  const [activeThreadId, setActiveThreadId] = useState('');
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0]?.id ?? '');
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const activeThreadIdRef = useRef(activeThreadId);
  activeThreadIdRef.current = activeThreadId;
  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;

  const queryClient = useQueryClient();
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        body: () => ({
          threadId: activeThreadIdRef.current,
          model: selectedModelRef.current,
        }),
      }),
    []
  );
  const { messages, sendMessage, setMessages, status, stop, error } = useChat({
    transport,
    onFinish: async () => {
      await queryClient.invalidateQueries({ queryKey: ['threads'] });
      if (activeThreadId) {
        await queryClient.invalidateQueries({
          queryKey: ['threads', activeThreadId, 'messages'],
        });
      }
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

  const { data: threads = [], isLoading: isThreadsLoading } = useQuery<
    ThreadItem[]
  >({
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

  const { data: activeMessages = [] } = useQuery<UIMessage[]>({
    queryKey: ['threads', activeThreadId, 'messages'],
    enabled: Boolean(activeThreadId),
    queryFn: async () => {
      const response = await fetch(`/api/threads/${activeThreadId}/messages`);
      if (!response.ok) {
        throw new Error('Failed to load messages');
      }
      const payload = (await response.json()) as { messages: UIMessage[] };
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
  const activeThread = useMemo(
    () => threads.find((thread: ThreadItem) => thread.id === activeThreadId),
    [activeThreadId, threads]
  );

  const prevThreadIdRef = useRef<string>('');

  useEffect(() => {
    if (!activeThreadId && threads.length > 0) {
      setActiveThreadId(threads[0]?.id ?? '');
    }
  }, [threads, activeThreadId]);

  // Sync messages only when thread changes
  useEffect(() => {
    if (!activeThreadId) {
      return;
    }
    if (prevThreadIdRef.current !== activeThreadId) {
      prevThreadIdRef.current = activeThreadId;
      stop();
      setMessages(activeMessages);
    }
  }, [activeThreadId, activeMessages, setMessages, stop]);

  const handleCreateThread = useCallback(() => {
    createThreadMutation.mutate();
  }, [createThreadMutation]);

  // Copy message content to clipboard
  const copyToClipboard = useCallback(async (messageId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  }, []);

  // Get selected model details
  const currentModel = useMemo(
    () => AVAILABLE_MODELS.find(m => m.id === selectedModel) ?? AVAILABLE_MODELS[0],
    [selectedModel]
  );

  // Handle voice input transcription
  const handleTranscription = useCallback((transcript: string) => {
    // Append transcript to the textarea (we'll need to use a ref for this)
    console.log('Transcription:', transcript);
  }, []);


  // Regenerate message - resend from a specific point
  const regenerateMessage = useCallback(
    (messageId: string) => {
      const messageIndex = messages.findIndex((m) => m.id === messageId);
      if (messageIndex === -1) return;

      // Remove all messages after this one (including this one)
      const messagesToKeep = messages.slice(0, messageIndex);
      setMessages(messagesToKeep);

      // Find the last user message to resend
      const lastUserMessage = messagesToKeep
        .slice()
        .reverse()
        .find((m) => m.role === 'user');

      if (lastUserMessage) {
        // Extract text from message parts
        const textParts = lastUserMessage.parts
          .filter((p) => p.type === 'text')
          .map((p) => (p.type === 'text' ? p.text : ''))
          .join('\n');

        // Resend the message
        sendMessage({ text: textParts });
      }
    },
    [messages, setMessages, sendMessage]
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f7f7f9,_#eef0f7_55%,_#e6e9f2_100%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl gap-6 px-4 py-6">
        <aside className="hidden h-[calc(100vh-3rem)] w-72 shrink-0 rounded-3xl border border-black/5 bg-white/70 p-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)] backdrop-blur md:flex md:flex-col">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Workspace
              </p>
              <h1 className="text-lg font-semibold text-foreground">Studio Chat</h1>
            </div>
            <Button
              size="icon"
              variant="outline"
              onClick={handleCreateThread}
              disabled={createThreadMutation.isPending}
            >
              <PlusIcon className="size-4" />
            </Button>
          </div>
          <div className="mt-6 space-y-2 overflow-y-auto">
            {isThreadsLoading ? (
              <p className="px-3 text-xs text-muted-foreground">
                Loading threads…
              </p>
            ) : threads.length === 0 ? (
              <p className="px-3 text-xs text-muted-foreground">
                No threads yet. Start a new chat.
              </p>
            ) : (
              threads.map((thread: ThreadItem) => {
                const isActive = thread.id === activeThreadId;
                return (
                  <button
                    key={thread.id}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                      isActive
                        ? 'border-transparent bg-foreground text-background shadow-lg shadow-black/10'
                        : 'border-black/5 bg-white/70 text-foreground hover:border-black/10 hover:bg-white'
                    }`}
                    onClick={() => setActiveThreadId(thread.id)}
                    type="button"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{thread.title}</span>
                      <span
                        className={`text-[11px] ${
                          isActive ? 'text-background/80' : 'text-muted-foreground'
                        }`}
                      >
                        {formatRelativeTime(thread.updatedAtMs)}
                      </span>
                    </div>
                    <p
                      className={`mt-2 line-clamp-2 text-xs leading-relaxed ${
                        isActive ? 'text-background/70' : 'text-muted-foreground'
                      }`}
                    >
                      {thread.preview}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <main className="flex h-[calc(100vh-3rem)] flex-1 flex-col overflow-hidden rounded-3xl border border-black/5 bg-white/80 shadow-[0_35px_80px_-60px_rgba(15,23,42,0.5)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 px-6 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                {activeThread ? 'Selected thread' : 'New conversation'}
              </p>
              <h2 className="text-lg font-semibold text-foreground">
                {activeThread?.title ?? 'New chat'}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              {/* Model Selector */}
              <ModelSelector open={modelSelectorOpen} onOpenChange={setModelSelectorOpen}>
                <ModelSelectorTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <ModelSelectorLogoGroup>
                      <ModelSelectorLogo provider={currentModel?.provider ?? 'google'} />
                    </ModelSelectorLogoGroup>
                    <span className="hidden sm:inline">{currentModel?.name}</span>
                    <SparklesIcon className="size-3" />
                  </Button>
                </ModelSelectorTrigger>
                <ModelSelectorContent>
                  <ModelSelectorInput placeholder="Search models..." />
                  <ModelSelectorList>
                    {AVAILABLE_MODELS.map((model) => (
                      <ModelSelectorItem
                        key={model.id}
                        value={model.id}
                        onSelect={() => {
                          setSelectedModel(model.id);
                          setModelSelectorOpen(false);
                        }}
                      >
                        <ModelSelectorLogoGroup>
                          <ModelSelectorLogo provider={model.provider} />
                        </ModelSelectorLogoGroup>
                        <div className="flex flex-col gap-0.5">
                          <ModelSelectorName>{model.name}</ModelSelectorName>
                          <span className="text-muted-foreground text-xs">
                            {model.description}
                          </span>
                        </div>
                      </ModelSelectorItem>
                    ))}
                  </ModelSelectorList>
                </ModelSelectorContent>
              </ModelSelector>

              {/* Token Usage Display */}
              {activeThread && <TokenUsageDisplay threadId={activeThread.id} />}

              {/* Status and Actions */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {activeThread ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteThreadMutation.mutate(activeThread.id)}
                          disabled={deleteThreadMutation.isPending}
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete thread</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : null}
                <span>
                  {status === 'streaming'
                    ? 'Streaming'
                    : status === 'submitted'
                      ? 'Thinking'
                      : 'Ready'}
                </span>
              </div>
            </div>
          </div>

          <Conversation className="flex-1">
            <ConversationContent className="px-6">
              {messages.length === 0 ? (
                <ConversationEmptyState
                  description="Start by asking for a brief, or drag in files to ground the response."
                  title="Plan, ask, and refine"
                />
              ) : (
                <>
                  {messages.map(message => {
                    const textContent = message.parts
                      .filter(p => p.type === 'text')
                      .map(p => (p.type === 'text' ? p.text : ''))
                      .join('\n');

                    return (
                      <Message from={message.role} key={message.id}>
                        <MessageContent>
                          {message.parts.map((part, index) => (
                            <MessagePartRenderer
                              key={`${message.id}-${index}`}
                              part={part}
                              messageId={message.id}
                              index={index}
                            />
                          ))}
                        </MessageContent>
                        <MessageToolbar className="justify-between">
                          <div className="flex gap-1">
                            {textContent && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="size-7"
                                      onClick={() => copyToClipboard(message.id, textContent)}
                                    >
                                      {copiedMessageId === message.id ? (
                                        <CheckIcon className="size-3 text-green-600" />
                                      ) : (
                                        <CopyIcon className="size-3" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {copiedMessageId === message.id ? 'Copied!' : 'Copy message'}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {/* Regenerate button for assistant messages */}
                            {message.role === 'assistant' && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="size-7"
                                      onClick={() => regenerateMessage(message.id)}
                                      disabled={status === 'streaming' || status === 'submitted'}
                                    >
                                      <RefreshCwIcon className="size-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Regenerate response</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {message.role === 'user' ? 'You' : 'Assistant'}
                          </span>
                        </MessageToolbar>
                      </Message>
                    );
                  })}
                  {/* Streaming indicator */}
                  {status === 'streaming' && (
                    <Message from="assistant">
                      <MessageContent>
                        <Shimmer className="text-sm">Thinking...</Shimmer>
                      </MessageContent>
                    </Message>
                  )}
                </>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div className="border-t border-black/5 px-6 py-4">
            <PromptInput
              onSubmit={async ({ text, files }) => {
                if (text.trim().length === 0 && files.length === 0) {
                  return;
                }

                if (!activeThreadId) {
                  // Auto-create a thread first
                  const response = await fetch('/api/threads', { method: 'POST' });
                  if (!response.ok) {
                    return;
                  }
                  const payload = (await response.json()) as { thread: ThreadItem };
                  queryClient.setQueryData<ThreadItem[]>(
                    ['threads'],
                    (prev) => [payload.thread, ...(prev ?? [])]
                  );
                  // Update ref immediately so transport picks it up
                  activeThreadIdRef.current = payload.thread.id;
                  setActiveThreadId(payload.thread.id);
                }

                sendMessage({ text, files });
              }}
            >
              <PromptInputBody className="gap-3 rounded-2xl border border-black/5 bg-white/70 px-3 py-2 shadow-inner">
                <PromptInputTextarea placeholder="Ask anything or drop files to ground the response." />
                <div className="flex items-center gap-2">
                  {/* Voice Input */}
                  <SpeechInput
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onTranscriptionChange={handleTranscription}
                  />
                  <PromptInputSubmit onStop={stop} status={status} />
                </div>
              </PromptInputBody>
            </PromptInput>
            {error ? (
              <p className="mt-2 text-xs text-destructive">
                {error.message || 'Something went wrong. Please try again.'}
              </p>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}