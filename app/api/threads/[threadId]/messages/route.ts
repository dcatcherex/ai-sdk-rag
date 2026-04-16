import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { UIMessage, UIMessagePart } from "ai";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { chatMessage, chatThread, mediaAsset, toolRun } from "@/db/schema";
import { extractMediaOutputUrls } from "@/lib/generation/media-job-types";

type DbErrorWithCode = {
  code?: string;
  cause?: {
    code?: string;
  };
};

type ImageFilePart = {
  type: "file";
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

type ToolRunHydrationRow = {
  id: string;
  status: string;
  outputJson: Record<string, unknown> | null;
  errorMessage: string | null;
};

type ToolOutputWithGenerationId = {
  generationId?: string;
  imageUrl?: string;
  imageUrls?: string[];
  thumbnailUrl?: string;
  thumbnailUrls?: string[];
};

const isImageFilePart = (part: UIMessagePart<any, any>): part is ImageFilePart => {
  if (part.type !== "file") {
    return false;
  }
  const record = part as Record<string, unknown>;
  return (
    typeof record.mediaType === "string" &&
    typeof record.url === "string" &&
    record.mediaType.startsWith("image/")
  );
};

const isMissingColumnError = (error: unknown) => {
  const typed = error as DbErrorWithCode;
  return typed?.code === "42703" || typed?.cause?.code === "42703";
};

const isToolLikePart = (
  part: UIMessagePart<any, any>,
): part is UIMessagePart<any, any> & {
  output?: ToolOutputWithGenerationId;
  errorText?: string;
  state?: string;
  toolName?: string;
} => {
  return typeof part.type === "string" && part.type.startsWith("tool-");
};

/** Tool names that represent async KIE media generation jobs. */
const MEDIA_TOOL_NAMES = new Set([
  "generate_image",
  "generate_video",
  "generate_music",
  "generate_speech",
]);

const isMediaGenerationToolPart = (
  part: UIMessagePart<any, any>,
): part is UIMessagePart<any, any> & {
  output?: ToolOutputWithGenerationId;
  errorText?: string;
  state?: string;
  toolName?: string;
} => {
  if (!isToolLikePart(part)) return false;
  const toolName = part.toolName || (typeof part.type === "string" ? part.type.replace(/^tool-/, "") : "");
  return MEDIA_TOOL_NAMES.has(toolName);
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const thread = await db
    .select({ id: chatThread.id })
    .from(chatThread)
    .where(and(eq(chatThread.id, threadId), eq(chatThread.userId, session.user.id)))
    .limit(1);

  if (thread.length === 0) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const rows = await db
    .select({
      id: chatMessage.id,
      role: chatMessage.role,
      parts: chatMessage.parts,
      metadata: chatMessage.metadata,
    })
    .from(chatMessage)
    .where(eq(chatMessage.threadId, threadId))
    .orderBy(asc(chatMessage.position));

  const generationIds = rows.flatMap((row) =>
    ((row.parts as UIMessage["parts"]) ?? []).flatMap((part) => {
      if (!isMediaGenerationToolPart(part)) return [];
      const generationId = part.output?.generationId;
      return typeof generationId === "string" && generationId.length > 0 ? [generationId] : [];
    }),
  );

  const toolRunRows = generationIds.length > 0
    ? await db
        .select({
          id: toolRun.id,
          status: toolRun.status,
          outputJson: toolRun.outputJson,
          errorMessage: toolRun.errorMessage,
        })
        .from(toolRun)
        .where(and(eq(toolRun.userId, session.user.id), inArray(toolRun.id, generationIds)))
    : [];

  const toolRunsById = new Map<string, ToolRunHydrationRow>();
  toolRunRows.forEach((row) => {
    toolRunsById.set(row.id, {
      id: row.id,
      status: row.status,
      outputJson: (row.outputJson as Record<string, unknown> | null) ?? null,
      errorMessage: row.errorMessage,
    });
  });

  const messageIds = rows.map((row) => row.id);
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

  if (messageIds.length) {
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
        .where(
          and(
            eq(mediaAsset.userId, session.user.id),
            inArray(mediaAsset.messageId, messageIds)
          )
        );
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
        .where(
          and(
            eq(mediaAsset.userId, session.user.id),
            inArray(mediaAsset.messageId, messageIds)
          )
        );
    }
  }

  const getHydrationAssetForPart = (messageId: string, partUrl: string) => {
    const assetsForMessage = assetRows.filter((asset) => asset.messageId === messageId);
    const exactMatch = assetsForMessage.find((asset) => asset.url === partUrl);
    if (exactMatch) {
      return exactMatch;
    }
    return assetsForMessage.length === 1 ? assetsForMessage[0] : undefined;
  };

  const assetsByMessage = new Map<
    string,
    Map<
      string,
      {
        id: string;
        url: string;
        thumbnailUrl?: string | null;
        width?: number | null;
        height?: number | null;
        parentAssetId?: string | null;
        rootAssetId?: string | null;
        version?: number | null;
        editPrompt?: string | null;
      }
    >
  >();
  assetRows.forEach((asset) => {
    if (!asset.messageId) {
      return;
    }
    if (!assetsByMessage.has(asset.messageId)) {
      assetsByMessage.set(asset.messageId, new Map());
    }
    assetsByMessage.get(asset.messageId)?.set(asset.url, asset);
  });

  const messages: UIMessage[] = rows.map((row) => {
    const parts = (row.parts as UIMessage["parts"]).map((part) => {
      if (isMediaGenerationToolPart(part)) {
        const generationId = part.output?.generationId;
        const run = generationId ? toolRunsById.get(generationId) : undefined;
        if (run) {
          if (run.status === "success") {
            const { outputUrls, thumbnailUrls } = extractMediaOutputUrls(run.outputJson);
            return {
              ...part,
              state: "output-available",
              output: {
                ...(part.output ?? {}),
                ...(outputUrls[0] ? { imageUrl: outputUrls[0] } : {}),
                ...(outputUrls.length > 0 ? { imageUrls: outputUrls } : {}),
                ...(thumbnailUrls[0] ? { thumbnailUrl: thumbnailUrls[0] } : {}),
                ...(thumbnailUrls.length > 0 ? { thumbnailUrls } : {}),
                status: "success",
              },
              errorText: undefined,
            } as UIMessage["parts"][number];
          }

          if (run.status === "error") {
            return {
              ...part,
              state: "output-error",
              errorText: run.errorMessage ?? part.errorText,
            } as UIMessage["parts"][number];
          }
        }
      }

      if (!isImageFilePart(part)) {
        return part;
      }
      const asset = assetsByMessage.get(row.id)?.get(part.url) ?? getHydrationAssetForPart(row.id, part.url);
      if (!asset) {
        return part;
      }
      return {
        ...part,
        url: asset.url,
        thumbnailUrl: asset.thumbnailUrl ?? undefined,
        width: part.width ?? asset.width ?? undefined,
        height: part.height ?? asset.height ?? undefined,
        assetId: asset.id,
        parentAssetId: asset.parentAssetId ?? undefined,
        rootAssetId: asset.rootAssetId ?? undefined,
        version: asset.version ?? undefined,
        editPrompt: asset.editPrompt ?? undefined,
      };
    });

    return {
      id: row.id,
      role: row.role as UIMessage["role"],
      parts,
      ...(row.metadata ? { metadata: row.metadata } : {}),
    };
  });

  return NextResponse.json({ messages });
}
