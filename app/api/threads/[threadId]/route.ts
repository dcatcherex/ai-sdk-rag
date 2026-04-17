import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { requireUser } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { chatThread } from "@/db/schema";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params;
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const body = (await request.json()) as { pinned?: boolean; title?: string };
  const updates: { pinned?: boolean; title?: string } = {};

  if (typeof body.pinned === "boolean") {
    updates.pinned = body.pinned;
  }

  if (typeof body.title === "string") {
    const trimmedTitle = body.title.trim();
    if (!trimmedTitle) {
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    }
    updates.title = trimmedTitle;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const result = await db
    .update(chatThread)
    .set(updates)
    .where(and(eq(chatThread.id, threadId), eq(chatThread.userId, authResult.user.id)))
    .returning({ id: chatThread.id, pinned: chatThread.pinned, title: chatThread.title });

  if (result.length === 0) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    pinned: result[0].pinned,
    title: result[0].title,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params;
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const result = await db
    .delete(chatThread)
    .where(and(eq(chatThread.id, threadId), eq(chatThread.userId, authResult.user.id)))
    .returning({ id: chatThread.id });

  if (result.length === 0) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
