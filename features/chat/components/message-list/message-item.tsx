'use client';

import type { ChatStatus } from 'ai';
import {
  CheckIcon,
  CopyIcon,
  InfoIcon,
  RefreshCwIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  Trash2Icon,
} from 'lucide-react';
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
import { filterRenderableMessageParts, getTextContentFromParts } from '@/features/chat/utils/message-parts';
import type { ChatMessage, ChatMessageMetadata, ChatMessagePart, MessageReaction, QuizFollowUpContext } from '@/features/chat/types';
import type { MediaAsset } from '@/features/gallery/types';
import { EnhancedPromptChip, GenerationDetails } from './generation-details';
import { FollowUpChips } from './follow-up-chips';
import type { ReactionMap, PendingDelete } from './types';

function hasSuccessfulInteractiveQuizTool(parts: ChatMessagePart[]): boolean {
  return parts.some((part) => {
    if (typeof part !== 'object' || part === null || typeof part.type !== 'string') {
      return false;
    }

    if (!part.type.startsWith('tool-')) {
      return false;
    }

    const record = part as Record<string, unknown>;
    const rawToolName = typeof record.toolName === 'string' ? record.toolName : part.type;
    const toolName = rawToolName.startsWith('tool-') ? rawToolName.slice(5) : rawToolName;
    const output = record.output;

    return (
      toolName === 'generate_practice_quiz'
      || toolName === 'create_study_plan'
      || toolName === 'analyze_learning_gaps'
      || toolName === 'generate_flashcards'
    )
      && typeof output === 'object'
      && output !== null
      && (output as Record<string, unknown>).success === true;
  });
}

type MessageItemProps = {
  message: ChatMessage;
  messages: ChatMessage[];
  msgIndex: number;
  status: ChatStatus;
  threadId?: string;
  isLastAssistant: boolean;
  isSyncingFollowUpSuggestions?: boolean;
  copiedMessageId: string | null;
  messageReactions: ReactionMap;
  isActiveMessage?: boolean;
  isDeleteHighlighted: boolean;
  openInfoId: string | null;
  onCopyMessage: (id: string, text: string) => void;
  onRegenerateMessage: (id: string) => void;
  onToggleReaction: (id: string, reaction: MessageReaction) => void;
  onSuggestionClick: (suggestion: string) => void;
  onImageClick?: (asset: MediaAsset) => void;
  onQuizStateChange?: (context: QuizFollowUpContext) => void;
  onRequestDelete: (pending: PendingDelete) => void;
  onHoverDeleteEnter: (ids: Set<string>) => void;
  onHoverDeleteLeave: () => void;
  onToggleInfo: (id: string | null) => void;
};

function getPair(
  message: ChatMessage,
  msgIndex: number,
  messages: ChatMessage[],
): PendingDelete {
  let partnerMessageId: string | undefined;
  if (message.role === 'user') {
    const next = messages[msgIndex + 1];
    if (next?.role === 'assistant') partnerMessageId = next.id;
  } else if (message.role === 'assistant') {
    const prev = messages[msgIndex - 1];
    if (prev?.role === 'user') partnerMessageId = prev.id;
  }
  return { messageId: message.id, partnerMessageId };
}

export const MessageItem = ({
  message,
  messages,
  msgIndex,
  status,
  threadId,
  isLastAssistant,
  isSyncingFollowUpSuggestions,
  copiedMessageId,
  messageReactions,
  isActiveMessage = false,
  isDeleteHighlighted,
  openInfoId,
  onCopyMessage,
  onRegenerateMessage,
  onToggleReaction,
  onSuggestionClick,
  onImageClick,
  onQuizStateChange,
  onRequestDelete,
  onHoverDeleteEnter,
  onHoverDeleteLeave,
  onToggleInfo,
}: MessageItemProps) => {
  const rawContentParts = filterRenderableMessageParts(message.parts as ChatMessagePart[]);
  const contentParts = message.role === 'assistant' && hasSuccessfulInteractiveQuizTool(rawContentParts)
    ? rawContentParts.filter((part) => part.type !== 'text')
    : rawContentParts;
  if (contentParts.length === 0) return null;

  const textContent = getTextContentFromParts(contentParts);

  const nextMsg = messages[msgIndex + 1];
  const enhancedPrompt =
    message.role === 'user' && nextMsg?.role === 'assistant'
      ? (nextMsg.metadata as ChatMessageMetadata | undefined)?.enhancedPrompt
      : undefined;

  const isGenerating = status === 'streaming' || status === 'submitted';

  const followUpSuggestions =
    isLastAssistant && status === 'ready'
      ? (message.metadata as ChatMessageMetadata | undefined)?.followUpSuggestions ?? []
      : [];
  const showFollowUpLoading = isLastAssistant && status === 'submitted';
  const showFollowUpSyncHint =
    isLastAssistant &&
    status === 'ready' &&
    isSyncingFollowUpSuggestions &&
    followUpSuggestions.length === 0;

  const handleDeleteClick = () => onRequestDelete(getPair(message, msgIndex, messages));
  const handleDeleteEnter = () => onHoverDeleteEnter(new Set(Object.values(getPair(message, msgIndex, messages)).filter(Boolean) as string[]));

  return (
    <div
      id={`msg-${message.id}`}
      data-message-id={message.id}
      className={`scroll-mt-4 rounded-xl transition-colors duration-150 ${
        isActiveMessage
          ? 'bg-primary/6 ring-1 ring-primary/15'
          : ''
      } ${
        isDeleteHighlighted
          ? 'bg-red-50/70 dark:bg-red-950/30 ring-1 ring-red-200 dark:ring-red-800/50'
          : ''
      }`}
    >
      <Message from={message.role}>
        <MessageContent>
          {contentParts.map((part, index) => (
            <MessagePartRenderer
              key={`${message.id}-${index}`}
              part={part}
              messageId={message.id}
              threadId={threadId}
              index={index}
              role={message.role}
              onImageClick={onImageClick}
              onQuizStateChange={onQuizStateChange}
            />
          ))}
          {enhancedPrompt && <EnhancedPromptChip text={enhancedPrompt} />}
          {showFollowUpLoading && (
            <div className="mt-3 flex gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-7 w-24 animate-pulse rounded-full bg-zinc-200 dark:bg-secondary" />
              ))}
            </div>
          )}
          {showFollowUpSyncHint && (
            <p className="mt-3 text-xs text-muted-foreground">Generating follow-up questions...</p>
          )}
          {followUpSuggestions.length > 0 && (
            <FollowUpChips suggestions={followUpSuggestions} onSuggestionClick={onSuggestionClick} />
          )}
          {openInfoId === message.id && message.metadata && (
            <GenerationDetails metadata={message.metadata as ChatMessageMetadata} />
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
                    {copiedMessageId === message.id ? 'Copied!' : 'Copy message'}
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
                      disabled={isGenerating}
                    >
                      <RefreshCwIcon className="size-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Regenerate response</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-muted-foreground hover:text-red-500"
                    onClick={handleDeleteClick}
                    onMouseEnter={handleDeleteEnter}
                    onMouseLeave={onHoverDeleteLeave}
                    disabled={isGenerating}
                  >
                    <Trash2Icon className="size-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete exchange</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {message.role === 'assistant' && (
              <>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className={`size-7 ${messageReactions[message.id] === 'thumbs_up' ? 'text-green-600' : ''}`}
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
                        className={`size-7 ${messageReactions[message.id] === 'thumbs_down' ? 'text-red-600' : ''}`}
                        onClick={() => onToggleReaction(message.id, 'thumbs_down')}
                      >
                        <ThumbsDownIcon className="size-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Not helpful</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {(message.metadata as ChatMessageMetadata | undefined)?.routing && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className={`size-7 ${openInfoId === message.id ? 'text-blue-500' : ''}`}
                          onClick={() => onToggleInfo(openInfoId === message.id ? null : message.id)}
                        >
                          <InfoIcon className="size-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Generation details</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </>
            )}
          </div>
        </MessageToolbar>
      </Message>
    </div>
  );
};

// Streaming placeholder shown while waiting for first token
export const StreamingPlaceholder = () => (
  <Message from="assistant">
    <MessageContent>
      <Shimmer className="text-sm">Thinking...</Shimmer>
    </MessageContent>
  </Message>
);
