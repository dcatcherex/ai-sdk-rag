import type { ChatMessage, MessageReaction, QuizFollowUpContext } from '@/features/chat/types';
import type { MediaAsset } from '@/features/gallery/types';

export type ReactionMap = Record<string, MessageReaction | null>;

export type FontSize = 'sm' | 'base' | 'lg' | 'xl';

export const FONT_SIZE_CLASS: Record<FontSize, string> = {
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
};

export type MessageGroupItem =
  | { type: 'regular'; message: ChatMessage; msgIndex: number }
  | { type: 'compareGroup'; messages: ChatMessage[]; groupId: string };

export type PendingDelete = {
  messageId: string;
  partnerMessageId?: string;
};

export type ChatMessageListProps = {
  messages: ChatMessage[];
  status: import('ai').ChatStatus;
  threadId?: string;
  isSyncingFollowUpSuggestions?: boolean;
  copiedMessageId: string | null;
  messageReactions: ReactionMap;
  fontSize?: FontSize;
  // agent starter prompts shown on empty state
  agentName?: string;
  agentDescription?: string | null;
  starterPrompts?: string[];
  onCopyMessage: (messageId: string, text: string) => void;
  onRegenerateMessage: (messageId: string) => void;
  onToggleReaction: (messageId: string, reaction: MessageReaction) => void;
  onSuggestionClick: (suggestion: string) => void;
  onImageClick?: (asset: MediaAsset) => void;
  onDeleteMessage: (messageId: string, partnerMessageId?: string) => void;
  onQuizStateChange?: (context: QuizFollowUpContext) => void;
};
