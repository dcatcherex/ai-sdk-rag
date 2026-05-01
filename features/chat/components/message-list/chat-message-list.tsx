'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { AgentChatEmptyState } from '@/features/chat/components/empty-state/agent-chat-empty-state';
import { SelectionContextMenu } from '@/features/chat/components/selection-context-menu';
import type { ChatMessagePart, ChatMessageMetadata } from '@/features/chat/types';
import { getTextContentFromParts } from '@/features/chat/utils/message-parts';
import { useStickToBottomContext } from 'use-stick-to-bottom';
import { CompareGroupCard } from './compare-group-card';
import { DeleteConfirmDialog } from './delete-confirm-dialog';
import { MessageItem, StreamingPlaceholder } from './message-item';
import { ThreadScrollMemory } from './thread-scroll-memory';
import { FONT_SIZE_CLASS } from './types';
import type { ChatMessageListProps, MessageGroupItem, PendingDelete } from './types';

export type { FontSize } from './types';

function ConversationSelectionMenu({
  onSuggestionClick,
}: {
  onSuggestionClick: (suggestion: string) => void;
}) {
  const { scrollRef } = useStickToBottomContext();

  return <SelectionContextMenu containerRef={scrollRef} onAction={onSuggestionClick} />;
}

function ConversationActiveMessageObserver({
  messageIds,
  onActiveMessageChange,
}: {
  messageIds: string[];
  onActiveMessageChange?: (messageId: string | null) => void;
}) {
  const { scrollRef } = useStickToBottomContext();

  useEffect(() => {
    if (!onActiveMessageChange) return;

    const root = scrollRef.current;
    if (!root || messageIds.length === 0) {
      onActiveMessageChange(null);
      return;
    }

    const visibleEntries = new Map<string, IntersectionObserverEntry>();

    const selectActiveMessage = () => {
      const rootTop = root.getBoundingClientRect().top;
      const nextEntry = [...visibleEntries.values()]
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => {
          const aDistance = Math.abs(a.boundingClientRect.top - rootTop);
          const bDistance = Math.abs(b.boundingClientRect.top - rootTop);
          if (aDistance !== bDistance) return aDistance - bDistance;
          return b.intersectionRatio - a.intersectionRatio;
        })[0];

      onActiveMessageChange(nextEntry?.target.getAttribute('data-message-id') ?? null);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const messageId = entry.target.getAttribute('data-message-id');
          if (!messageId) continue;

          if (entry.isIntersecting) {
            visibleEntries.set(messageId, entry);
          } else {
            visibleEntries.delete(messageId);
          }
        }

        selectActiveMessage();
      },
      {
        root,
        threshold: [0.1, 0.35, 0.65],
        rootMargin: '-10% 0px -55% 0px',
      },
    );

    const elements = messageIds
      .map((messageId) => root.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`))
      .filter((element): element is HTMLElement => !!element);

    for (const element of elements) {
      observer.observe(element);
    }

    selectActiveMessage();

    return () => {
      observer.disconnect();
    };
  }, [messageIds, onActiveMessageChange, scrollRef]);

  return null;
}

export const ChatMessageList = ({
  messages,
  status,
  threadId,
  activeMessageId,
  isSyncingFollowUpSuggestions = false,
  copiedMessageId,
  messageReactions,
  fontSize = 'sm',
  agentName,
  agentDescription,
  starterTasks,
  generalStarterPrompts = [],
  onEmptyStateTaskSelect,
  onCopyMessage,
  onRegenerateMessage,
  onToggleReaction,
  onSuggestionClick,
  onImageClick,
  onUseImageInChat,
  onDeleteMessage,
  onQuizStateChange,
  onActiveMessageChange,
}: ChatMessageListProps) => {
  const lastAssistantIdx = messages.reduce((acc, message, index) => (message.role === 'assistant' ? index : acc), -1);
  const scrollPositionsRef = useRef<Map<string, number>>(new Map());
  const pendingRestoreThreadKeyRef = useRef<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [hoveredDeleteIds, setHoveredDeleteIds] = useState<Set<string>>(new Set());
  const [openInfoId, setOpenInfoId] = useState<string | null>(null);

  const groupedItems = useMemo((): MessageGroupItem[] => {
    const result: MessageGroupItem[] = [];
    let index = 0;
    while (index < messages.length) {
      const message = messages[index];
      const groupId = (message.metadata as ChatMessageMetadata | undefined)?.compareGroupId;
      if (message.role === 'assistant' && groupId) {
        const group = [message];
        let nextIndex = index + 1;
        while (nextIndex < messages.length) {
          const nextMessage = messages[nextIndex];
          const nextGroupId = (nextMessage.metadata as ChatMessageMetadata | undefined)?.compareGroupId;
          if (nextMessage.role === 'assistant' && nextGroupId === groupId) {
            group.push(nextMessage);
            nextIndex += 1;
          } else {
            break;
          }
        }
        result.push({ type: 'compareGroup', messages: group, groupId });
        index = nextIndex;
      } else {
        result.push({ type: 'regular', message, msgIndex: index });
        index += 1;
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

  const regularMessageIds = useMemo(
    () =>
      groupedItems
        .filter((item): item is Extract<MessageGroupItem, { type: 'regular' }> => item.type === 'regular')
        .map((item) => item.message.id),
    [groupedItems],
  );

  const conversationKey = threadId ?? 'new-thread';

  return (
    <Conversation
      className={`flex-1 min-h-0 ${FONT_SIZE_CLASS[fontSize]}`}
      initial={false}
    >
      <ConversationActiveMessageObserver
        messageIds={regularMessageIds}
        onActiveMessageChange={onActiveMessageChange}
      />
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
          <AgentChatEmptyState
            agentName={agentName}
            agentDescription={agentDescription}
            starterTasks={starterTasks}
            generalStarterPrompts={generalStarterPrompts}
            onSelectTask={onEmptyStateTaskSelect}
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
                  isActiveMessage={message.id === activeMessageId}
                  isDeleteHighlighted={hoveredDeleteIds.has(message.id)}
                  openInfoId={openInfoId}
                  onCopyMessage={onCopyMessage}
                  onRegenerateMessage={onRegenerateMessage}
                  onToggleReaction={onToggleReaction}
                  onSuggestionClick={onSuggestionClick}
                  onImageClick={onImageClick}
                  onUseImageInChat={onUseImageInChat}
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
