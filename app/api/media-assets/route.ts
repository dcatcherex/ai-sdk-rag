import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { mediaAsset } from "@/db/schema";

const MAX_LIMIT = 200;

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit") ?? "120");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), MAX_LIMIT) : 120;
  const type = searchParams.get("type");

  const conditions = [eq(mediaAsset.userId, session.user.id)];
  if (type) {
    conditions.push(eq(mediaAsset.type, type));
  }

  const rows = await db
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
