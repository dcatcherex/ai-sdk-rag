import { z } from 'zod';
import type { UIDataTypes, UIMessagePart } from 'ai';
import type { ChatTools } from '@/lib/tools';
import type { ChatMessage } from '@/features/chat/types';

export { type ChatMessage };

export const requestSchema = z.object({
  threadId: z.string().min(1),
  messages: z.array(z.custom<ChatMessage>()),
  model: z.string().optional(),
  useWebSearch: z.boolean().optional(),
  selectedDocumentIds: z.array(z.string()).optional(),
  enabledModelIds: z.array(z.string()).optional(),
  agentId: z.string().optional(),
  personaId: z.string().optional(),
});

export type ChatRequest = z.infer<typeof requestSchema>;

// Image file part shape stored in message parts
export type ImageFilePart = {
  type: 'file';
  mediaType: string;
  url: string;
  filename?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  assetId?: string;
  parentAssetId?: string;
  rootAssetId?: string;
  version?: number;
  editPrompt?: string;
};

export type MediaAssetInsert = {
  id: string;
  userId: string;
  threadId: string;
  messageId: string;
  rootAssetId: string;
  version: number;
  editPrompt: string | null;
  type: string;
  r2Key: string;
  url: string;
  thumbnailKey: string;
  thumbnailUrl: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
};

export type UploadPartResult = {
  part: UIMessagePart<UIDataTypes, ChatTools> | ImageFilePart;
  asset?: MediaAssetInsert;
};

export type TokenUsageSnapshot = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};
