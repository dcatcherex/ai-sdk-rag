import type { messagingApi } from '@line/bot-sdk';

// Type aliases that match what MessagingApiClient.replyMessage() expects
export type LineMessage    = messagingApi.Message;
export type FlexMessage    = messagingApi.FlexMessage;
export type FlexBubble     = messagingApi.FlexBubble;
export type FlexComponent  = messagingApi.FlexComponent;
export type QuickReply     = messagingApi.QuickReply;
export type QuickReplyItem = messagingApi.QuickReplyItem;

export type Sender = { name: string; iconUrl?: string };
export type LinkedUser = { userId: string; displayName: string | null };
export type MessagePart =
  | { type: 'text'; text: string }
  | { type: string; [key: string]: unknown };

export type AgentRow = {
  id: string;
  name: string | null;
  systemPrompt: string | null;
  modelId: string | null;
  brandId: string | null;
  starterPrompts: string[];
} | null;

// LINE brand green
export const LINE_GREEN = '#06C755';
// LINE quick reply label max length
export const QUICK_REPLY_LABEL_MAX = 20;
// Min bullet points to trigger Flex rendering
export const FLEX_BULLET_THRESHOLD = 2;
// How many recent messages to include as context
export const MAX_CONTEXT_MESSAGES = 20;
