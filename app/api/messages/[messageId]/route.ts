import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { chatMessage, chatThread } from "@/db/schema";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional partner message to delete together (pair deletion)
  let alsoDeleteId: string | undefined;
  try {
    const body = await request.json() as { alsoDeleteId?: string };
    alsoDeleteId = body.alsoDeleteId;
  } catch {
    // No body — single delete
  }

  const idsToDelete = [messageId, ...(alsoDeleteId ? [alsoDeleteId] : [])];

  // Verify all messages belong to the user
  const found = await db
    .select({ id: chatMessage.id })
    .from(chatMessage)
    .innerJoin(chatThread, eq(chatMessage.threadId, chatThread.id))
    .where(
      and(
        inArray(chatMessage.id, idsToDelete),
        eq(chatThread.userId, session.user.id)
      )
    );

  if (found.length === 0) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const verifiedIds = found.map((r) => r.id);
  await db.delete(chatMessage).where(inArray(chatMessage.id, verifiedIds));

  return NextResponse.json({ ok: true });
}
