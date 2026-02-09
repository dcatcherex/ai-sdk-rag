import { useCallback, useEffect, useState } from 'react';
import type { ChatMessage, MessageReaction } from '../types';

type ReactionMap = Record<string, MessageReaction | null>;

export const useMessageReactions = (messages: ChatMessage[]) => {
  const [messageReactions, setMessageReactions] = useState<ReactionMap>({});

  useEffect(() => {
    const reactions: ReactionMap = {};
    messages.forEach((msg) => {
      if (msg.reaction) {
        reactions[msg.id] = msg.reaction;
      }
    });
    setMessageReactions(reactions);
  }, [messages]);

  const toggleReaction = useCallback(
    async (messageId: string, reaction: MessageReaction) => {
      const currentReaction = messageReactions[messageId];
      const newReaction = currentReaction === reaction ? null : reaction;

      setMessageReactions((prev) => ({ ...prev, [messageId]: newReaction }));

      try {
        await fetch(`/api/messages/${messageId}/reaction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reaction: newReaction }),
        });
      } catch (error) {
        setMessageReactions((prev) => ({ ...prev, [messageId]: currentReaction }));
        console.error('Failed to update reaction:', error);
      }
    },
    [messageReactions]
  );

  return { messageReactions, toggleReaction };
};
