import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';

import { requireUser } from "@/lib/auth-server";
import { db } from '@/lib/db';
import { promptLibrary } from '@/db/schema';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const { id } = await params;

  // Built-in prompts have no DB row — skip silently
  if (id.startsWith('builtin_')) {
    return NextResponse.json({ success: true });
  }

  await db
    .update(promptLibrary)
    .set({ usageCount: sql`${promptLibrary.usageCount} + 1` })
    .where(eq(promptLibrary.id, id));

  return NextResponse.json({ success: true });
}
