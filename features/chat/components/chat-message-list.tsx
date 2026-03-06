'use client';

import { useState } from 'react';
import type { ChatStatus } from 'ai';
import { CheckIcon, ChevronDownIcon, CopyIcon, RefreshCwIcon, SparklesIcon, ThumbsDownIcon, ThumbsUpIcon } from 'lucide-react';
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

type ReactionMap = Record<string, MessageReaction | null>;

type ChatMessageListProps = {
  messages: ChatMessage[];
  status: ChatStatus;
  copiedMessageId: string | null;
  messageReactions: ReactionMap;
  onCopyMessage: (messageId: string, text: string) => void;
  onRegenerateMessage: (messageId: string) => void;
  onToggleReaction: (messageId: string, reaction: MessageReaction) => void;
  onSuggestionClick: (suggestion: string) => void;
};

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

export const ChatMessageList = ({
  messages,
  status,
  copiedMessageId,
  messageReactions,
  onCopyMessage,
  onRegenerateMessage,
  onToggleReaction,
  onSuggestionClick,
}: ChatMessageListProps) => {
  const lastAssistantIdx = messages.reduce((acc, m, i) => (m.role === 'assistant' ? i : acc), -1);

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
          {messages.map((message, msgIndex) => {
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
            const followUpSuggestions =
              msgIndex === lastAssistantIdx && status === 'ready'
                ? (message.metadata as ChatMessageMetadata | undefined)?.followUpSuggestions ?? []
                : [];

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
                  {enhancedPrompt && <EnhancedPromptChip text={enhancedPrompt} />}
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
