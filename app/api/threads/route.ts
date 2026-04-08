import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { chatThread, mediaAsset } from "@/db/schema";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const threads = await db
    .select({
      id: chatThread.id,
      title: chatThread.title,
      preview: chatThread.preview,
      pinned: chatThread.pinned,
      updatedAt: chatThread.updatedAt,
    })
    .from(chatThread)
    .where(eq(chatThread.userId, session.user.id))
    .orderBy(desc(chatThread.updatedAt));

  const imageAssets = await db
    .select({
      threadId: mediaAsset.threadId,
      thumbnailUrl: mediaAsset.thumbnailUrl,
      url: mediaAsset.url,
    })
    .from(mediaAsset)
    .where(eq(mediaAsset.userId, session.user.id))
    .orderBy(desc(mediaAsset.createdAt));

  const firstImageByThread = new Map<string, string>();
  imageAssets.forEach((asset) => {
    if (!asset.threadId) {
      return;
    }
    if (!firstImageByThread.has(asset.threadId)) {
      firstImageByThread.set(asset.threadId, asset.thumbnailUrl ?? asset.url);
    }
  });

  return NextResponse.json(
    {
      threads: threads.map((thread) => ({
        id: thread.id,
        title: thread.title,
        preview: thread.preview,
        pinned: thread.pinned,
        hasGeneratedImage: firstImageByThread.has(thread.id),
        imageThumbnailUrl: firstImageByThread.get(thread.id) ?? null,
        updatedAtMs: thread.updatedAt.getTime(),
      })),
    },
    {
      headers: {
        'Cache-Control': 'private, s-maxage=10, stale-while-revalidate=30',
      },
    }
  );
}

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const thread = {
    id: crypto.randomUUID(),
    userId: session.user.id,
    title: "New chat",
    preview: "Start a conversation…",
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(chatThread).values(thread);

  return NextResponse.json({
    thread: {
      id: thread.id,
      title: thread.title,
      preview: thread.preview,
      pinned: false,
      hasGeneratedImage: false,
      imageThumbnailUrl: null,
      updatedAtMs: thread.updatedAt.getTime(),
    },
  });
}
