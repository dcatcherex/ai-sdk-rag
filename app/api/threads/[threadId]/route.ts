import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { chatThread } from "@/db/schema";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { pinned?: boolean };
  if (typeof body.pinned !== "boolean") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const result = await db
    .update(chatThread)
    .set({ pinned: body.pinned })
    .where(and(eq(chatThread.id, threadId), eq(chatThread.userId, session.user.id)))
    .returning({ id: chatThread.id, pinned: chatThread.pinned });

  if (result.length === 0) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, pinned: result[0].pinned });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await db
    .delete(chatThread)
    .where(and(eq(chatThread.id, threadId), eq(chatThread.userId, session.user.id)))
    .returning({ id: chatThread.id });

  if (result.length === 0) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
