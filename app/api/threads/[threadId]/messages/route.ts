import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import type { UIMessage } from "ai";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { chatMessage, chatThread } from "@/db/schema";

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
    })
    .from(chatMessage)
    .where(eq(chatMessage.threadId, threadId))
    .orderBy(asc(chatMessage.position));

  const messages: UIMessage[] = rows.map((row) => ({
    id: row.id,
    role: row.role as UIMessage["role"],
    parts: row.parts as UIMessage["parts"],
  }));

  return NextResponse.json({ messages });
}
