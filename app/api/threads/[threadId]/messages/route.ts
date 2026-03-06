import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { UIMessage, UIMessagePart } from "ai";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { chatMessage, chatThread, mediaAsset } from "@/db/schema";

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

  const messageIds = rows.map((row) => row.id);
  let assetRows: Array<{
    id: string;
    messageId: string;
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
  const assetsByMessage = new Map<
    string,
    Map<
      string,
      {
        id: string;
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
    if (!assetsByMessage.has(asset.messageId)) {
      assetsByMessage.set(asset.messageId, new Map());
    }
    assetsByMessage.get(asset.messageId)?.set(asset.url, asset);
  });

  const messages: UIMessage[] = rows.map((row) => {
    const parts = (row.parts as UIMessage["parts"]).map((part) => {
      if (!isImageFilePart(part) || part.thumbnailUrl) {
        return part;
      }
      const asset = assetsByMessage.get(row.id)?.get(part.url);
      if (!asset) {
        return part;
      }
      return {
        ...part,
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
