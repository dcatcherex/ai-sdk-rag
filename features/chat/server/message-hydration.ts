import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { mediaAsset, toolRun } from '@/db/schema';
import { extractMediaOutputUrls } from '@/lib/generation/media-job-types';
import type { ChatMessage } from '@/features/chat/types';
import type { ImageAttachmentPart } from './image-context';

type DbErrorWithCode = {
  code?: string;
  cause?: {
    code?: string;
  };
};

type ToolOutputWithGenerationId = {
  generationId?: string;
  imageUrl?: string;
  imageUrls?: string[];
  thumbnailUrl?: string;
  thumbnailUrls?: string[];
  status?: string;
};

type ToolRunHydrationRow = {
  id: string;
  status: string;
  outputJson: Record<string, unknown> | null;
  errorMessage: string | null;
};

const MEDIA_TOOL_NAMES = new Set([
  'generate_image',
  'generate_video',
  'generate_music',
  'generate_speech',
]);

const isMissingColumnError = (error: unknown) => {
  const typed = error as DbErrorWithCode;
  return typed?.code === '42703' || typed?.cause?.code === '42703';
};

const isMediaGenerationToolPart = (
  part: ChatMessage['parts'][number],
): part is ChatMessage['parts'][number] & {
  output?: ToolOutputWithGenerationId;
  errorText?: string;
  state?: string;
  toolName?: string;
} => {
  if (typeof part.type !== 'string' || !part.type.startsWith('tool-')) {
    return false;
  }

  const toolName = (part as { toolName?: unknown }).toolName;
  if (typeof toolName !== 'string') {
    return false;
  }

  return MEDIA_TOOL_NAMES.has(toolName);
};

export async function hydrateIncomingChatMessages(messages: ChatMessage[], userId: string): Promise<ChatMessage[]> {
  const messageIds = messages
    .map((message) => message.id)
    .filter((messageId): messageId is string => typeof messageId === 'string' && messageId.length > 0);
  const generationIds = messages.flatMap((message) =>
    (message.parts ?? []).flatMap((part) => {
      if (!part || typeof part !== 'object' || typeof part.type !== 'string' || !part.type.startsWith('tool-')) {
        return [];
      }
      const output = (part as { output?: ToolOutputWithGenerationId }).output;
      return typeof output?.generationId === 'string' && output.generationId.length > 0
        ? [output.generationId]
        : [];
    })
  );

  if (messageIds.length === 0 && generationIds.length === 0) {
    return messages;
  }

  let assetRows: Array<{
    id: string;
    messageId: string | null;
    url: string;
    thumbnailUrl: string | null;
    width: number | null;
    height: number | null;
    parentAssetId?: string | null;
    rootAssetId?: string | null;
    version?: number | null;
    editPrompt?: string | null;
  }> = [];
  const toolRunsById = new Map<string, ToolRunHydrationRow>();

  try {
    assetRows = await db
      .select({
        id: mediaAsset.id,
        messageId: mediaAsset.messageId,
        url: mediaAsset.url,
        thumbnailUrl: mediaAsset.thumbnailUrl,
        width: mediaAsset.width,
        height: mediaAsset.height,
        parentAssetId: mediaAsset.parentAssetId,
        rootAssetId: mediaAsset.rootAssetId,
        version: mediaAsset.version,
        editPrompt: mediaAsset.editPrompt,
      })
      .from(mediaAsset)
      .where(and(eq(mediaAsset.userId, userId), inArray(mediaAsset.messageId, messageIds)));
  } catch (error) {
    if (!isMissingColumnError(error)) {
      throw error;
    }

    assetRows = await db
      .select({
        id: mediaAsset.id,
        messageId: mediaAsset.messageId,
        url: mediaAsset.url,
        thumbnailUrl: mediaAsset.thumbnailUrl,
        width: mediaAsset.width,
        height: mediaAsset.height,
      })
      .from(mediaAsset)
      .where(and(eq(mediaAsset.userId, userId), inArray(mediaAsset.messageId, messageIds)));
  }

  if (generationIds.length > 0) {
    const uniqueGenerationIds = Array.from(new Set(generationIds));
    const toolRunRows = await db
      .select({
        id: toolRun.id,
        status: toolRun.status,
        outputJson: toolRun.outputJson,
        errorMessage: toolRun.errorMessage,
      })
      .from(toolRun)
      .where(and(eq(toolRun.userId, userId), inArray(toolRun.id, uniqueGenerationIds)));

    toolRunRows.forEach((row) => {
      toolRunsById.set(row.id, {
        id: row.id,
        status: row.status,
        outputJson: (row.outputJson as Record<string, unknown> | null) ?? null,
        errorMessage: row.errorMessage,
      });
    });
  }

  if (assetRows.length === 0 && toolRunsById.size === 0) {
    return messages;
  }

  const getHydrationAssetForPart = (messageId: string, partUrl: string) => {
    const assetsForMessage = assetRows.filter((asset) => asset.messageId === messageId);
    const exactMatch = assetsForMessage.find((asset) => asset.url === partUrl);
    if (exactMatch) {
      return exactMatch;
    }
    return assetsForMessage.length === 1 ? assetsForMessage[0] : undefined;
  };

  const assetsByMessage = new Map<string, Map<string, (typeof assetRows)[number]>>();
  assetRows.forEach((asset) => {
    if (!asset.messageId) {
      return;
    }
    if (!assetsByMessage.has(asset.messageId)) {
      assetsByMessage.set(asset.messageId, new Map());
    }
    assetsByMessage.get(asset.messageId)?.set(asset.url, asset);
  });

  return messages.map((message) => {
    if (!message.id || !message.parts?.length) {
      return message;
    }

    let changed = false;
    const parts = message.parts.map((part) => {
      if (!part || typeof part !== 'object') {
        return part;
      }

      if (isMediaGenerationToolPart(part)) {
        const toolPart = part;
        const generationId = toolPart.output?.generationId;
        const run = generationId ? toolRunsById.get(generationId) : undefined;
        if (run?.status === 'success') {
          const { outputUrls, thumbnailUrls } = extractMediaOutputUrls(run.outputJson);
          console.log('[IMG-URL-TRACE] hydrate tool part', {
            generationId,
            rawOutput: run.outputJson ? JSON.stringify(run.outputJson).substring(0, 200) : null,
            resolvedUrls: outputUrls.map(u => u.substring(0, 80)),
          });
          if (outputUrls.length > 0 || thumbnailUrls.length > 0) {
            changed = true;
            return {
              ...toolPart,
              state: 'output-available',
              output: {
                ...(toolPart.output ?? {}),
                ...(outputUrls[0] ? { imageUrl: outputUrls[0] } : {}),
                ...(outputUrls.length > 0 ? { imageUrls: outputUrls } : {}),
                ...(thumbnailUrls[0] ? { thumbnailUrl: thumbnailUrls[0] } : {}),
                ...(thumbnailUrls.length > 0 ? { thumbnailUrls } : {}),
                status: 'success',
              },
              errorText: undefined,
            } as ChatMessage['parts'][number];
          }
        }
      }

      const record = part as Record<string, unknown>;
      if (
        record.type !== 'file' ||
        typeof record.url !== 'string' ||
        typeof record.mediaType !== 'string' ||
        !record.mediaType.startsWith('image/')
      ) {
        return part;
      }

      const imagePart = part as ImageAttachmentPart;
      const asset = assetsByMessage.get(message.id)?.get(imagePart.url) ?? getHydrationAssetForPart(message.id, imagePart.url);
      if (!asset) {
        return part;
      }

      changed = true;
      return {
        ...imagePart,
        url: asset.url,
        thumbnailUrl: asset.thumbnailUrl ?? imagePart.thumbnailUrl,
        width: imagePart.width ?? asset.width ?? undefined,
        height: imagePart.height ?? asset.height ?? undefined,
        assetId: asset.id,
        parentAssetId: asset.parentAssetId ?? imagePart.parentAssetId,
        rootAssetId: asset.rootAssetId ?? imagePart.rootAssetId,
        version: asset.version ?? imagePart.version,
        editPrompt: asset.editPrompt ?? imagePart.editPrompt,
      };
    }) as ChatMessage['parts'];

    return changed ? { ...message, parts } : message;
  });
}
