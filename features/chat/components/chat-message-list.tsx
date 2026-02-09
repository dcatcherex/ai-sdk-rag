'use client';

import type { ChatStatus } from 'ai';
import { CheckIcon, CopyIcon, RefreshCwIcon, ThumbsDownIcon, ThumbsUpIcon } from 'lucide-react';
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
import type { ChatMessage, ChatMessagePart, MessageReaction } from '../types';

type ReactionMap = Record<string, MessageReaction | null>;

type ChatMessageListProps = {
  messages: ChatMessage[];
  status: ChatStatus;
  copiedMessageId: string | null;
  messageReactions: ReactionMap;
  onCopyMessage: (messageId: string, text: string) => void;
  onRegenerateMessage: (messageId: string) => void;
  onToggleReaction: (messageId: string, reaction: MessageReaction) => void;
};

export const ChatMessageList = ({
  messages,
  status,
  copiedMessageId,
  messageReactions,
  onCopyMessage,
  onRegenerateMessage,
  onToggleReaction,
}: ChatMessageListProps) => (
  <Conversation className="flex-1">
    <ConversationContent className="px-3 md:px-6">
      {messages.length === 0 ? (
        <ConversationEmptyState
          description="Start by asking for a brief, or drag in files to ground the response."
          title="Plan, ask, and refine"
        />
      ) : (
        <>
          {messages.map((message) => {
            const contentParts = filterRenderableMessageParts(
              message.parts as ChatMessagePart[]
            );

            if (contentParts.length === 0) {
              return null;
            }

            const textContent = getTextContentFromParts(contentParts);

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
