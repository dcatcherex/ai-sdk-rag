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
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpenIcon, CheckIcon, ChevronDownIcon, CopyIcon, DownloadIcon, FileTextIcon, PlusIcon, RefreshCwIcon, SearchIcon, SparklesIcon, ThumbsDownIcon, ThumbsUpIcon, Trash2Icon } from 'lucide-react';
import { KnowledgePanel } from '@/components/knowledge/knowledge-panel';
import { useDocumentStats } from '@/lib/hooks/use-documents';
import { Badge } from '@/components/ui/badge';
import { availableModels } from '@/lib/ai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessagePartRenderer } from '@/components/message-renderer';
import { TokenUsageDisplay } from '@/components/token-usage-display';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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

export default function Chat() {
  const [activeThreadId, setActiveThreadId] = useState('');
  const [selectedModel, setSelectedModel] = useState(availableModels[0]?.id ?? '');
  const [enabledModelIds, setEnabledModelIds] = useState<string[]>(
    () => availableModels.map((model) => model.id)
  );
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [enabledModelsOpen, setEnabledModelsOpen] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageReactions, setMessageReactions] = useState<Record<string, string | null>>({});
  const [knowledgePanelOpen, setKnowledgePanelOpen] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const { data: docStats } = useDocumentStats();

  const activeThreadIdRef = useRef(activeThreadId);
  activeThreadIdRef.current = activeThreadId;
  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;
  const selectedDocIdsRef = useRef(selectedDocIds);
  selectedDocIdsRef.current = selectedDocIds;

  const queryClient = useQueryClient();
  const enabledModels = useMemo(
    () => availableModels.filter((model) => enabledModelIds.includes(model.id)),
    [enabledModelIds]
  );
  const handleToggleModel = useCallback((modelId: string) => {
    setEnabledModelIds((prev) => {
      const isEnabled = prev.includes(modelId);
      let next = isEnabled ? prev.filter((id) => id !== modelId) : [...prev, modelId];
      if (next.length === 0) {
        return prev;
      }
      next = availableModels
        .filter((model) => next.includes(model.id))
        .map((model) => model.id);
      return next;
    });
  }, []);
  const handleToggleSelectDoc = useCallback((docId: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        body: () => ({
          threadId: activeThreadIdRef.current,
          model: selectedModelRef.current,
          selectedDocumentIds: selectedDocIdsRef.current.size > 0
            ? [...selectedDocIdsRef.current]
            : undefined,
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
    const stored = localStorage.getItem('chat-enabled-models');
    if (!stored) {
      return;
    }
    try {
      const parsed = JSON.parse(stored) as string[];
      const valid = parsed.filter((modelId) =>
        availableModels.some((model) => model.id === modelId)
      );
      if (valid.length > 0) {
        setEnabledModelIds(valid);
      }
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('chat-enabled-models', JSON.stringify(enabledModelIds));
  }, [enabledModelIds]);

  useEffect(() => {
    if (enabledModels.length === 0) {
      return;
    }
    if (!enabledModels.some((model) => model.id === selectedModel)) {
      setSelectedModel(enabledModels[0].id);
    }
  }, [enabledModels, selectedModel]);

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
    () => enabledModels.find((model) => model.id === selectedModel)
      ?? enabledModels[0]
      ?? availableModels[0],
    [selectedModel, enabledModels]
  );

  // Handle voice input transcription
  const handleTranscription = useCallback((transcript: string) => {
    // Append transcript to the textarea (we'll need to use a ref for this)
    console.log('Transcription:', transcript);
  }, []);

  // Filter threads based on search query
  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;
    const query = searchQuery.toLowerCase();
    return threads.filter(
      (thread: ThreadItem) =>
        thread.title.toLowerCase().includes(query) ||
        thread.preview.toLowerCase().includes(query)
    );
  }, [threads, searchQuery]);

  // Export conversation
  const exportConversation = useCallback(async (format: 'json' | 'markdown') => {
    if (!activeThreadId) return;
    try {
      const response = await fetch(
        `/api/threads/${activeThreadId}/export?format=${format}`
      );
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversation-${activeThreadId}.${format === 'json' ? 'json' : 'md'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export error:', error);
    }
  }, [activeThreadId]);

  // Handle message reactions
  const toggleReaction = useCallback(
    async (messageId: string, reaction: 'thumbs_up' | 'thumbs_down') => {
      const currentReaction = messageReactions[messageId];
      const newReaction = currentReaction === reaction ? null : reaction;

      // Optimistic update
      setMessageReactions((prev) => ({ ...prev, [messageId]: newReaction }));

      try {
        await fetch(`/api/messages/${messageId}/reaction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reaction: newReaction }),
        });
      } catch (error) {
        // Revert on error
        setMessageReactions((prev) => ({ ...prev, [messageId]: currentReaction }));
        console.error('Failed to update reaction:', error);
      }
    },
    [messageReactions]
  );

  // Load message reactions from messages
  useEffect(() => {
    const reactions: Record<string, string | null> = {};
    messages.forEach((msg) => {
      const msgData = msg as any;
      if (msgData.reaction) {
        reactions[msg.id] = msgData.reaction;
      }
    });
    setMessageReactions(reactions);
  }, [messages]);


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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K - New thread
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        handleCreateThread();
      }

      // Cmd/Ctrl + / - Focus search
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        document.getElementById('thread-search')?.focus();
      }

      // Escape - Clear search
      if (e.key === 'Escape' && searchQuery) {
        setSearchQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCreateThread, searchQuery]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f7f7f9,_#eef0f7_55%,_#e6e9f2_100%)]">
      <div className={`mx-auto flex min-h-screen w-full gap-6 px-4 py-6 ${knowledgePanelOpen ? 'max-w-[90rem]' : 'max-w-6xl'}`}>
        <aside className="hidden h-[calc(100vh-3rem)] w-72 shrink-0 rounded-3xl border border-black/5 bg-white/70 p-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)] backdrop-blur md:flex md:flex-col">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Workspace
              </p>
              <h1 className="text-lg font-semibold text-foreground">Studio Chat</h1>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={handleCreateThread}
                    disabled={createThreadMutation.isPending}
                  >
                    <PlusIcon className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>New thread (⌘K)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Thread Search */}
          <div className="relative mt-4">
            <SearchIcon className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input
              id="thread-search"
              type="text"
              placeholder="Search threads... (⌘/)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 text-sm"
            />
          </div>

          <div className="mt-4 space-y-2 overflow-y-auto">
            {isThreadsLoading ? (
              <p className="px-3 text-xs text-muted-foreground">
                Loading threads…
              </p>
            ) : filteredThreads.length === 0 ? (
              <p className="px-3 text-xs text-muted-foreground">
                {searchQuery ? 'No threads found.' : 'No threads yet. Start a new chat.'}
              </p>
            ) : (
              filteredThreads.map((thread: ThreadItem) => {
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
                  <div className="border-b border-border px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Choose model
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                      Pick from your enabled models. Configure below.
                    </p>
                  </div>
                  <ModelSelectorInput placeholder="Search models..." />
                  <ModelSelectorList>
                    {enabledModels.map((model) => (
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
                  <div className="border-t border-border px-4 py-3">
                    <Collapsible open={enabledModelsOpen} onOpenChange={setEnabledModelsOpen}>
                      <CollapsibleTrigger asChild>
                        <button
                          className="group flex w-full items-center justify-between text-left"
                          type="button"
                        >
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                              Enabled models
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {enabledModelIds.length} selected • Click to manage
                            </p>
                          </div>
                          <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-3 max-h-64 overflow-y-auto pr-1">
                          <div className="grid gap-2">
                          {availableModels.map((model) => (
                            <label
                              key={model.id}
                              className="flex items-center gap-3 rounded-lg border border-border/70 px-3 py-2 text-xs text-foreground"
                            >
                              <Checkbox
                                checked={enabledModelIds.includes(model.id)}
                                onCheckedChange={() => handleToggleModel(model.id)}
                              />
                              <span className="flex flex-col">
                                <span className="text-sm font-medium">{model.name}</span>
                                <span className="text-muted-foreground">{model.description}</span>
                              </span>
                            </label>
                          ))}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </ModelSelectorContent>
              </ModelSelector>

              {/* Token Usage Display */}
              {activeThread && <TokenUsageDisplay threadId={activeThread.id} />}

              {/* Status and Actions */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {activeThread && (
                  <>
                    {/* Export Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost">
                          <DownloadIcon className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => exportConversation('json')}>
                          <FileTextIcon className="mr-2 size-4" />
                          Export as JSON
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportConversation('markdown')}>
                          <FileTextIcon className="mr-2 size-4" />
                          Export as Markdown
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

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
                  </>
                )}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant={knowledgePanelOpen ? 'default' : 'ghost'}
                        onClick={() => setKnowledgePanelOpen((v) => !v)}
                        className="relative"
                      >
                        <BookOpenIcon className="size-4" />
                        {docStats && docStats.totalDocuments > 0 && (
                          <Badge
                            variant="secondary"
                            className="absolute -top-1.5 -right-1.5 size-4 justify-center p-0 text-[9px]"
                          >
                            {docStats.totalDocuments}
                          </Badge>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Knowledge base</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
                    // Filter out control messages (step-start, step-finish, etc.)
                    const contentParts = message.parts.filter(
                      (p: any) =>
                        p.type !== 'step-start' &&
                        p.type !== 'step-finish' &&
                        p.type !== 'step-result'
                    );

                    // Only render messages that have actual content
                    if (contentParts.length === 0) return null;

                    const textContent = contentParts
                      .filter(p => p.type === 'text')
                      .map(p => (p.type === 'text' ? p.text : ''))
                      .join('\n');

                    return (
                      <Message from={message.role} key={message.id}>
                        <MessageContent>
                          {contentParts.map((part, index) => (
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
                            {/* Message Reactions */}
                            {message.role === 'assistant' && (
                              <>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className={`size-7 ${
                                          messageReactions[message.id] === 'thumbs_up'
                                            ? 'text-green-600'
                                            : ''
                                        }`}
                                        onClick={() => toggleReaction(message.id, 'thumbs_up')}
                                      >
                                        <ThumbsUpIcon className="size-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Helpful</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className={`size-7 ${
                                          messageReactions[message.id] === 'thumbs_down'
                                            ? 'text-red-600'
                                            : ''
                                        }`}
                                        onClick={() => toggleReaction(message.id, 'thumbs_down')}
                                      >
                                        <ThumbsDownIcon className="size-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Not helpful</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </>
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
            {selectedDocIds.size > 0 && (
              <div className="mb-2 flex items-center gap-1.5 text-xs text-primary">
                <BookOpenIcon className="size-3.5" />
                <span className="font-medium">
                  Grounded mode — answering from {selectedDocIds.size} selected document{selectedDocIds.size !== 1 ? 's' : ''}
                </span>
              </div>
            )}
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

        {knowledgePanelOpen && (
          <div className="hidden h-[calc(100vh-3rem)] lg:block">
            <KnowledgePanel
              selectedDocIds={selectedDocIds}
              onToggleSelect={handleToggleSelectDoc}
            />
          </div>
        )}
      </div>
    </div>
  );
}