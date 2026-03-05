import type { UIDataTypes, UIMessage, UIMessagePart } from 'ai';
import type { ChatTools } from '@/lib/tools';

export type ThreadItem = {
  id: string;
  title: string;
  preview: string;
  pinned: boolean;
  hasGeneratedImage: boolean;
  imageThumbnailUrl: string | null;
  updatedAtMs: number;
};

export type RoutingMetadata = {
  mode: 'auto' | 'manual';
  modelId: string;
  reason: string;
};

export type ChatMessageMetadata = {
  routing?: RoutingMetadata;
};

export type MessageReaction = 'thumbs_up' | 'thumbs_down';

export type StepControlPart = {
  type: 'step-start' | 'step-finish' | 'step-result';
};

export type ChatMessagePart =
  | UIMessagePart<UIDataTypes, ChatTools>
  | StepControlPart;

export type ChatMessage = UIMessage<ChatMessageMetadata, UIDataTypes, ChatTools> & {
  reaction?: MessageReaction | null;
};
