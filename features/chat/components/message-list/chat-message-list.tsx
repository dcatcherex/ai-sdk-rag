'use client';

import { useMemo, useRef, useState } from 'react';
import { BotIcon } from 'lucide-react';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { FollowUpChips } from './follow-up-chips';
import type { ChatMessageMetadata } from '@/features/chat/types';
import { SelectionContextMenu } from '@/features/chat/components/selection-context-menu';
import { CompareGroupCard } from './compare-group-card';
import { DeleteConfirmDialog } from './delete-confirm-dialog';
import { MessageItem, StreamingPlaceholder } from './message-item';
import { ThreadScrollMemory } from './thread-scroll-memory';
import { FONT_SIZE_CLASS } from './types';
import type { ChatMessageListProps, MessageGroupItem, PendingDelete } from './types';
import { getTextContentFromParts } from '@/features/chat/utils/message-parts';
import type { ChatMessagePart } from '@/features/chat/types';
import { useStickToBottomContext } from 'use-stick-to-bottom';

export type { FontSize } from './types';

function ConversationSelectionMenu({
  onSuggestionClick,
}: {
  onSuggestionClick: (suggestion: string) => void;
}) {
  const { scrollRef } = useStickToBottomContext();

  return <SelectionContextMenu containerRef={scrollRef} onAction={onSuggestionClick} />;
}

export const ChatMessageList = ({
  messages,
  status,
  threadId,
  isSyncingFollowUpSuggestions = false,
  copiedMessageId,
  messageReactions,
  fontSize = 'sm',
  agentName,
  agentDescription,
  starterPrompts,
  generalStarterPrompts = [],
  onCopyMessage,
  onRegenerateMessage,
  onToggleReaction,
  onSuggestionClick,
  onImageClick,
  onDeleteMessage,
  onQuizStateChange,
}: ChatMessageListProps) => {
  const lastAssistantIdx = messages.reduce((acc, m, i) => (m.role === 'assistant' ? i : acc), -1);
  const scrollPositionsRef = useRef<Map<string, number>>(new Map());
  const pendingRestoreThreadKeyRef = useRef<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [hoveredDeleteIds, setHoveredDeleteIds] = useState<Set<string>>(new Set());
  const [openInfoId, setOpenInfoId] = useState<string | null>(null);

  const groupedItems = useMemo((): MessageGroupItem[] => {
    const result: MessageGroupItem[] = [];
    let i = 0;
    while (i < messages.length) {
      const msg = messages[i];
      const groupId = (msg.metadata as ChatMessageMetadata | undefined)?.compareGroupId;
      if (msg.role === 'assistant' && groupId) {
        const group = [msg];
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

  const hasVisibleAssistantText = useMemo(() => {
    const lastAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant');
    if (!lastAssistantMessage) {
      return false;
    }

    const parts = (lastAssistantMessage.parts ?? []) as ChatMessagePart[];
    return getTextContentFromParts(parts).trim().length > 0;
  }, [messages]);

  const conversationKey = threadId ?? 'new-thread';

  return (
    <Conversation
      className={`flex-1 min-h-0 ${FONT_SIZE_CLASS[fontSize]}`}
      initial={false}
    >
      <ThreadScrollMemory
        threadKey={conversationKey}
        threadId={threadId}
        messagesLength={messages.length}
        pendingRestoreThreadKeyRef={pendingRestoreThreadKeyRef}
        scrollPositionsRef={scrollPositionsRef}
      />
      <ConversationContent
        className="px-3 md:px-6"
        scrollClassName="chat-scroll-area h-full"
      >
        {messages.length === 0 ? (
          agentName && starterPrompts && starterPrompts.length > 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center px-4">
              <div className="rounded-full bg-primary/10 p-3">
                <BotIcon className="size-7 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-base">{agentName}</p>
                {agentDescription && (
                  <p className="mt-1 text-sm text-muted-foreground max-w-sm">{agentDescription}</p>
                )}
              </div>
              <FollowUpChips suggestions={starterPrompts} onSuggestionClick={onSuggestionClick} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 px-4 py-16 text-center">
              <div className="rounded-full bg-primary/10 p-3">
                <BotIcon className="size-7 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-base">Your Vaja AI coworker is ready</p>
                <p className="mx-auto max-w-md text-sm text-muted-foreground">
                  Start with a real task, ask for a draft, or connect your work context with files and skills.
                </p>
              </div>
              {generalStarterPrompts.length > 0 ? (
                <FollowUpChips suggestions={generalStarterPrompts} onSuggestionClick={onSuggestionClick} />
              ) : null}
            </div>
          )
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
              return (
                <MessageItem
                  key={message.id}
                  message={message}
                  messages={messages}
                  msgIndex={msgIndex}
                  status={status}
                  threadId={threadId}
                  isLastAssistant={msgIndex === lastAssistantIdx}
                  isSyncingFollowUpSuggestions={isSyncingFollowUpSuggestions}
                  copiedMessageId={copiedMessageId}
                  messageReactions={messageReactions}
                  isDeleteHighlighted={hoveredDeleteIds.has(message.id)}
                  openInfoId={openInfoId}
                  onCopyMessage={onCopyMessage}
                  onRegenerateMessage={onRegenerateMessage}
                  onToggleReaction={onToggleReaction}
                  onSuggestionClick={onSuggestionClick}
                  onImageClick={onImageClick}
                  onQuizStateChange={onQuizStateChange}
                  onRequestDelete={setPendingDelete}
                  onHoverDeleteEnter={setHoveredDeleteIds}
                  onHoverDeleteLeave={() => setHoveredDeleteIds(new Set())}
                  onToggleInfo={setOpenInfoId}
                />
              );
            })}
            {status === 'streaming' && !hasVisibleAssistantText && <StreamingPlaceholder />}
          </>
        )}
      </ConversationContent>

      <ConversationScrollButton />
      <ConversationSelectionMenu onSuggestionClick={onSuggestionClick} />

      <DeleteConfirmDialog
        pendingDelete={pendingDelete}
        onConfirm={(messageId, partnerMessageId) => {
          onDeleteMessage(messageId, partnerMessageId);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </Conversation>
  );
};
