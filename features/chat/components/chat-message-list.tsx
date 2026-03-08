'use client';

import { useMemo, useState } from 'react';
import type { ChatStatus } from 'ai';
import { CheckIcon, ChevronDownIcon, CopyIcon, RefreshCwIcon, SparklesIcon, ThumbsDownIcon, ThumbsUpIcon } from 'lucide-react';
import { Streamdown } from 'streamdown';
import { CodeBlock } from '@/components/ai-elements/code-block';
import { ModelSelectorLogo } from '@/components/ai-elements/model-selector';
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
import { Shimmer } from '@/components/ai-elements/shimmer';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { MessagePartRenderer } from '@/components/message-renderer';
import {
  filterRenderableMessageParts,
  getTextContentFromParts,
} from '../utils/message-parts';
import type { ChatMessage, ChatMessageMetadata, ChatMessagePart, MessageReaction } from '../types';
import type { MediaAsset } from '@/features/gallery/types';

type ReactionMap = Record<string, MessageReaction | null>;

type ChatMessageListProps = {
  messages: ChatMessage[];
  status: ChatStatus;
  threadId?: string;
  isSyncingFollowUpSuggestions?: boolean;
  copiedMessageId: string | null;
  messageReactions: ReactionMap;
  onCopyMessage: (messageId: string, text: string) => void;
  onRegenerateMessage: (messageId: string) => void;
  onToggleReaction: (messageId: string, reaction: MessageReaction) => void;
  onSuggestionClick: (suggestion: string) => void;
  onImageClick?: (asset: MediaAsset) => void;
};

// ── Compare group card ──────────────────────────────────────────────────────

const CompareMarkdown = ({ content }: { content: string }) => (
  <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:whitespace-pre-wrap [&_ul]:list-none [&_ul]:pl-0 [&_ul>li]:pl-5 [&_ul>li]:my-0.5 [&_ul>li]:indent-[-1em] [&_ul>li]:before:content-['•'] [&_ul>li]:before:mr-1.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol>li]:my-0.5 [&_ol>li]:pl-1.5 [&_ol>li]:indent-[-0.25em]">
    <Streamdown
      components={{
        code: ({ inline, className, children, ...props }: any) => {
          const match = /language-(\w+)/.exec(className || '');
          const codeContent = String(children).replace(/\n$/, '');
          if (!inline && match) {
            return <CodeBlock code={codeContent} language={match[1] as any} />;
          }
          return (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm" {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children }: any) => <>{children}</>,
      }}
    >
      {content}
    </Streamdown>
  </div>
);

const CompareGroupCard = ({
  messages,
  messageReactions,
  onToggleReaction,
}: {
  messages: ChatMessage[];
  messageReactions: ReactionMap;
  onToggleReaction: (messageId: string, reaction: MessageReaction) => void;
}) => {
  const gridClass =
    messages.length <= 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : messages.length === 3
        ? 'grid-cols-1 sm:grid-cols-3'
        : 'grid-cols-2';

  return (
    <div className={`my-3 grid gap-3 ${gridClass}`}>
      {messages.map((m) => {
        const meta = m.metadata as ChatMessageMetadata;
        const modelInfo = { provider: (meta.compareModelId ?? '').split('/')[0] ?? 'google' };
        const textContent = (m.parts as any[])
          .filter((p) => p.type === 'text')
          .map((p) => p.text)
          .join('');
        const imagePart = (m.parts as any[]).find((p) => p.type === 'file');
        const reaction = messageReactions[m.id];

        return (
          <div
            key={m.id}
            className="flex flex-col overflow-hidden rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-zinc-900"
          >
            <div className="flex items-center gap-2 border-b border-black/5 dark:border-white/10 bg-zinc-50/80 dark:bg-zinc-800/50 px-3 py-1.5">
              <ModelSelectorLogo provider={modelInfo.provider as any} />
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate flex-1">
                {meta.compareModelName ?? meta.compareModelId}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 max-h-[400px]">
              {imagePart ? (
                <img src={imagePart.url} alt="Generated" className="max-w-full rounded-lg" />
              ) : textContent ? (
                <CompareMarkdown content={textContent} />
              ) : null}
            </div>
            <div className="flex gap-1 border-t border-black/5 dark:border-white/10 px-3 py-1.5">
              <Button
                size="icon"
                variant="ghost"
                className={`size-6 ${reaction === 'thumbs_up' ? 'text-green-600' : ''}`}
                onClick={() => onToggleReaction(m.id, 'thumbs_up')}
              >
                <ThumbsUpIcon className="size-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className={`size-6 ${reaction === 'thumbs_down' ? 'text-red-500' : ''}`}
                onClick={() => onToggleReaction(m.id, 'thumbs_down')}
              >
                <ThumbsDownIcon className="size-3" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────

const EnhancedPromptChip = ({ text }: { text: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-full bg-violet-50 dark:bg-violet-950/40 px-2.5 py-0.5 text-[11px] font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
      >
        <SparklesIcon className="size-3" />
        Enhanced
        <ChevronDownIcon className={`size-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <p className="mt-1.5 rounded-lg border border-violet-100 dark:border-violet-900/40 bg-violet-50/60 dark:bg-violet-950/20 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
          {text}
        </p>
      )}
    </div>
  );
};

const FollowUpChips = ({ suggestions, onSuggestionClick }: {
  suggestions: string[];
  onSuggestionClick: (suggestion: string) => void;
}) => (
  <div className="mt-3 flex flex-wrap gap-2">
    {suggestions.map((s) => (
      <button
        key={s}
        type="button"
        onClick={() => onSuggestionClick(s)}
        className="rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 px-3 py-1 text-[12px] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors text-left"
      >
        {s}
      </button>
    ))}
  </div>
);

type MessageGroupItem =
  | { type: 'regular'; message: ChatMessage; msgIndex: number }
  | { type: 'compareGroup'; messages: ChatMessage[]; groupId: string };

export const ChatMessageList = ({
  messages,
  status,
  threadId,
  isSyncingFollowUpSuggestions = false,
  copiedMessageId,
  messageReactions,
  onCopyMessage,
  onRegenerateMessage,
  onToggleReaction,
  onSuggestionClick,
  onImageClick,
}: ChatMessageListProps) => {
  const lastAssistantIdx = messages.reduce((acc, m, i) => (m.role === 'assistant' ? i : acc), -1);

  // Group consecutive compare-assistant messages together
  const groupedItems = useMemo((): MessageGroupItem[] => {
    const result: MessageGroupItem[] = [];
    let i = 0;
    while (i < messages.length) {
      const msg = messages[i];
      const groupId = (msg.metadata as ChatMessageMetadata | undefined)?.compareGroupId;
      if (msg.role === 'assistant' && groupId) {
        const group: ChatMessage[] = [msg];
        let j = i + 1;
        while (j < messages.length) {
          const next = messages[j];
          const nextGroupId = (next.metadata as ChatMessageMetadata | undefined)?.compareGroupId;
          if (next.role === 'assistant' && nextGroupId === groupId) {
            group.push(next);
            j++;
          } else {
            break;
          }
        }
        result.push({ type: 'compareGroup', messages: group, groupId });
        i = j;
      } else {
        result.push({ type: 'regular', message: msg, msgIndex: i });
        i++;
      }
    }
    return result;
  }, [messages]);

  return (
  <Conversation className="flex-1">
    <ConversationContent className="px-3 md:px-6">
      {messages.length === 0 ? (
        <ConversationEmptyState
          description="Start by asking for a brief, or drag in files to ground the response."
          title="Plan, ask, and refine"
        />
      ) : (
        <>
          {groupedItems.map((item) => {
            if (item.type === 'compareGroup') {
              return (
                <CompareGroupCard
                  key={item.groupId}
                  messages={item.messages}
                  messageReactions={messageReactions}
                  onToggleReaction={onToggleReaction}
                />
              );
            }

            const { message, msgIndex } = item;
            const contentParts = filterRenderableMessageParts(
              message.parts as ChatMessagePart[]
            );

            if (contentParts.length === 0) {
              return null;
            }

            const textContent = getTextContentFromParts(contentParts);

            // Check next message (assistant) for enhancedPrompt
            const nextMsg = messages[msgIndex + 1];
            const enhancedPrompt = message.role === 'user' && nextMsg?.role === 'assistant'
              ? (nextMsg.metadata as ChatMessageMetadata | undefined)?.enhancedPrompt
              : undefined;

            // Show follow-up suggestions only on the last assistant message when ready
            const isLastAssistant = msgIndex === lastAssistantIdx && message.role === 'assistant';
            const followUpSuggestions =
              isLastAssistant && status === 'ready'
                ? (message.metadata as ChatMessageMetadata | undefined)?.followUpSuggestions ?? []
                : [];
            const showFollowUpLoading = isLastAssistant && status === 'submitted';
            const showFollowUpSyncHint =
              isLastAssistant
              && status === 'ready'
              && isSyncingFollowUpSuggestions
              && followUpSuggestions.length === 0;

            return (
              <div key={message.id} id={`msg-${message.id}`} className="scroll-mt-4">
              <Message from={message.role}>
                <MessageContent>
                  {contentParts.map((part, index) => (
                    <MessagePartRenderer
                      key={`${message.id}-${index}`}
                      part={part}
                      messageId={message.id}
                      threadId={threadId}
                      index={index}
                      onImageClick={onImageClick}
                    />
                  ))}
                  {enhancedPrompt && <EnhancedPromptChip text={enhancedPrompt} />}
                  {showFollowUpLoading && (
                    <div className="mt-3 flex gap-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-7 w-24 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
                      ))}
                    </div>
                  )}
                  {showFollowUpSyncHint && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Generating follow-up questions...
                    </p>
                  )}
                  {followUpSuggestions.length > 0 && (
                    <FollowUpChips suggestions={followUpSuggestions} onSuggestionClick={onSuggestionClick} />
                  )}
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
                              onClick={() => onCopyMessage(message.id, textContent)}
                            >
                              {copiedMessageId === message.id ? (
                                <CheckIcon className="size-3 text-green-600" />
                              ) : (
                                <CopyIcon className="size-3" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {copiedMessageId === message.id
                              ? 'Copied!'
                              : 'Copy message'}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {message.role === 'assistant' && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7"
                              onClick={() => onRegenerateMessage(message.id)}
                              disabled={status === 'streaming' || status === 'submitted'}
                            >
                              <RefreshCwIcon className="size-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Regenerate response</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
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
                                onClick={() => onToggleReaction(message.id, 'thumbs_up')}
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
                                onClick={() => onToggleReaction(message.id, 'thumbs_down')}
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
              </div>
            );
          })}
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
  );
};
