'use client';

import { useMemo, useRef, useState } from 'react';
import { BotIcon } from 'lucide-react';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { FollowUpChips } from './follow-up-chips';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ChatMessageMetadata } from '@/features/chat/types';
import { SelectionContextMenu } from '@/features/chat/components/selection-context-menu';
import { CompareGroupCard } from './compare-group-card';
import { DeleteConfirmDialog } from './delete-confirm-dialog';
import { MessageItem, StreamingPlaceholder } from './message-item';
import { ThreadScrollMemory } from './thread-scroll-memory';
import { FONT_SIZE_CLASS } from './types';
import type { ChatMessageListProps, MessageGroupItem, PendingDelete } from './types';

export type { FontSize } from './types';

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
  onCopyMessage,
  onRegenerateMessage,
  onToggleReaction,
  onSuggestionClick,
  onImageClick,
  onDeleteMessage,
  onQuizStateChange,
}: ChatMessageListProps) => {
  const lastAssistantIdx = messages.reduce((acc, m, i) => (m.role === 'assistant' ? i : acc), -1);
  const contentRef = useRef<HTMLDivElement>(null);
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

  const conversationKey = threadId ?? 'new-thread';

  return (
    <ScrollArea ref={contentRef} className={`flex-1 flex flex-col overflow-hidden min-h-0 ${FONT_SIZE_CLASS[fontSize]}`}>
      <Conversation className="flex-1" initial={false}>
        <ThreadScrollMemory
          threadKey={conversationKey}
          threadId={threadId}
          messagesLength={messages.length}
          pendingRestoreThreadKeyRef={pendingRestoreThreadKeyRef}
          scrollPositionsRef={scrollPositionsRef}
        />
        <ConversationContent className="px-3 md:px-6">
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
              <ConversationEmptyState
                title="Plan, ask, and refine"
                description="Start by asking for a brief, or drag in files to ground the response."
              />
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
              {status === 'streaming' && <StreamingPlaceholder />}
            </>
          )}
        </ConversationContent>

        <ConversationScrollButton />
        <SelectionContextMenu containerRef={contentRef} onAction={onSuggestionClick} />

        <DeleteConfirmDialog
          pendingDelete={pendingDelete}
          onConfirm={(messageId, partnerMessageId) => {
            onDeleteMessage(messageId, partnerMessageId);
            setPendingDelete(null);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      </Conversation>
    </ScrollArea>
  );
};
