import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { chatThread, mediaAsset } from "@/db/schema";
import { parseGuestCookie, getGuestSessionById } from "@/lib/guest-access";

export async function GET() {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });

  // Guest thread listing
  if (!session?.user) {
    const guestId = parseGuestCookie(h.get('cookie'));
    if (!guestId) return NextResponse.json({ threads: [] });
    const gs = await getGuestSessionById(guestId);
    if (!gs) return NextResponse.json({ threads: [] });

    const threads = await db
      .select({ id: chatThread.id, title: chatThread.title, preview: chatThread.preview, pinned: chatThread.pinned, updatedAt: chatThread.updatedAt })
      .from(chatThread)
      .where(eq(chatThread.guestSessionId, guestId))
      .orderBy(desc(chatThread.updatedAt));

    return NextResponse.json({
      threads: threads.map((t) => ({ id: t.id, title: t.title, preview: t.preview, pinned: t.pinned, hasGeneratedImage: false, imageThumbnailUrl: null, updatedAtMs: t.updatedAt.getTime() })),
    });
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
    .where(and(eq(chatThread.userId, session.user.id), isNull(chatThread.guestSessionId)))
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

export async function POST(req: Request) {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });

  // Guest thread creation
  if (!session?.user) {
    const guestId = parseGuestCookie(h.get('cookie'));
    if (!guestId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const gs = await getGuestSessionById(guestId);
    if (!gs) return NextResponse.json({ error: "Guest session expired or invalid" }, { status: 401 });

    const now = new Date();
    const thread = { id: crypto.randomUUID(), guestSessionId: guestId, title: "New chat", preview: "Start a conversation…", createdAt: now, updatedAt: now };
    await db.insert(chatThread).values(thread);
    return NextResponse.json({ thread: { id: thread.id, title: thread.title, preview: thread.preview, pinned: false, hasGeneratedImage: false, imageThumbnailUrl: null, updatedAtMs: now.getTime() } });
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
