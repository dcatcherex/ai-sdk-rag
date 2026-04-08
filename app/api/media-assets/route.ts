import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, desc, eq, or } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { mediaAsset } from "@/db/schema";

const MAX_LIMIT = 200;

type DbErrorWithCode = {
  code?: string;
  cause?: {
    code?: string;
  };
};

const isMissingColumnError = (error: unknown) => {
  const typed = error as DbErrorWithCode;
  return typed?.code === "42703" || typed?.cause?.code === "42703";
};

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit") ?? "120");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), MAX_LIMIT) : 120;
  const type = searchParams.get("type");
  const rootAssetId = searchParams.get("rootAssetId");
  const threadId = searchParams.get("threadId");
  const messageId = searchParams.get("messageId");

  const conditions = [eq(mediaAsset.userId, session.user.id)];
  if (type) {
    conditions.push(eq(mediaAsset.type, type));
  }
  if (rootAssetId) {
    // Include both the root asset itself (id = rootAssetId) and all its children (rootAssetId = rootAssetId)
    conditions.push(or(eq(mediaAsset.id, rootAssetId), eq(mediaAsset.rootAssetId, rootAssetId))!);
  }
  if (threadId) {
    conditions.push(eq(mediaAsset.threadId, threadId));
  }
  if (messageId) {
    conditions.push(eq(mediaAsset.messageId, messageId));
  }

  let rows: Array<{
    id: string;
    type: string;
    url: string;
    thumbnailUrl: string | null;
    width: number | null;
    height: number | null;
    mimeType: string;
    threadId: string | null;
    messageId: string | null;
    parentAssetId?: string | null;
    rootAssetId?: string | null;
    version?: number | null;
    editPrompt?: string | null;
    createdAt: Date;
  }> = [];

  try {
    rows = await db
      .select({
        id: mediaAsset.id,
        type: mediaAsset.type,
        url: mediaAsset.url,
        thumbnailUrl: mediaAsset.thumbnailUrl,
        width: mediaAsset.width,
        height: mediaAsset.height,
        mimeType: mediaAsset.mimeType,
        threadId: mediaAsset.threadId,
        messageId: mediaAsset.messageId,
        parentAssetId: mediaAsset.parentAssetId,
        rootAssetId: mediaAsset.rootAssetId,
        version: mediaAsset.version,
        editPrompt: mediaAsset.editPrompt,
        createdAt: mediaAsset.createdAt,
      })
      .from(mediaAsset)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0])
      .orderBy(desc(mediaAsset.createdAt))
      .limit(limit);
  } catch (error) {
    if (!isMissingColumnError(error)) {
      throw error;
    }

    rows = await db
      .select({
        id: mediaAsset.id,
        type: mediaAsset.type,
        url: mediaAsset.url,
        thumbnailUrl: mediaAsset.thumbnailUrl,
        width: mediaAsset.width,
        height: mediaAsset.height,
        mimeType: mediaAsset.mimeType,
        threadId: mediaAsset.threadId,
        messageId: mediaAsset.messageId,
        createdAt: mediaAsset.createdAt,
      })
      .from(mediaAsset)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0])
      .orderBy(desc(mediaAsset.createdAt))
      .limit(limit);
  }

  return NextResponse.json(
    {
      assets: rows.map((row) => ({
        ...row,
        createdAtMs: row.createdAt.getTime(),
      })),
    },
    {
      headers: {
        'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=120',
      },
    }
  );
}
