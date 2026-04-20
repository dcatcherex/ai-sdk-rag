import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";

import { getCurrentUser } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { chatThread, mediaAsset } from "@/db/schema";
import { parseGuestCookie, getGuestSessionById } from "@/lib/guest-access";

export async function GET() {
  const h = await headers();
  const user = await getCurrentUser();

  // Guest thread listing
  if (!user) {
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
      threads: threads.map((t) => ({ id: t.id, title: t.title, preview: t.preview, pinned: t.pinned, hasGeneratedImage: false, imageThumbnailUrl: null, updatedAtMs: t.updatedAt.getTime(), agentId: null })),
    });
  }

  const threads = await db
    .select({
      id: chatThread.id,
      title: chatThread.title,
      preview: chatThread.preview,
      pinned: chatThread.pinned,
      agentId: chatThread.agentId,
      updatedAt: chatThread.updatedAt,
    })
    .from(chatThread)
    .where(and(eq(chatThread.userId, user.id), isNull(chatThread.guestSessionId)))
    .orderBy(desc(chatThread.updatedAt));

  const imageAssets = await db
    .select({
      threadId: mediaAsset.threadId,
      thumbnailUrl: mediaAsset.thumbnailUrl,
      url: mediaAsset.url,
    })
    .from(mediaAsset)
    .where(eq(mediaAsset.userId, user.id))
    .orderBy(desc(mediaAsset.createdAt));

  const firstImageByThread = new Map<string, string>();
  imageAssets.forEach((asset) => {
    if (!asset.threadId) return;
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
        agentId: thread.agentId ?? null,
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
  const user = await getCurrentUser();

  let agentId: string | null = null;
  try {
    const body = await req.json() as { agentId?: string | null };
    agentId = body.agentId ?? null;
  } catch {
    // No body is fine
  }

  // Guest thread creation
  if (!user) {
    const guestId = parseGuestCookie(h.get('cookie'));
    if (!guestId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const gs = await getGuestSessionById(guestId);
    if (!gs) return NextResponse.json({ error: "Guest session expired or invalid" }, { status: 401 });

    const now = new Date();
    const thread = { id: crypto.randomUUID(), guestSessionId: guestId, title: "New chat", preview: "Start a conversation…", createdAt: now, updatedAt: now };
    await db.insert(chatThread).values(thread);
    return NextResponse.json({ thread: { id: thread.id, title: thread.title, preview: thread.preview, pinned: false, hasGeneratedImage: false, imageThumbnailUrl: null, updatedAtMs: now.getTime(), agentId: null } });
  }

  const now = new Date();
  const thread = {
    id: crypto.randomUUID(),
    userId: user.id,
    agentId,
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
      agentId: thread.agentId ?? null,
      hasGeneratedImage: false,
      imageThumbnailUrl: null,
      updatedAtMs: thread.updatedAt.getTime(),
    },
  });
}
