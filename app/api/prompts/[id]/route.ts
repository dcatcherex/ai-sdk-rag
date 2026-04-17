import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { requireUser } from "@/lib/auth-server";
import { db } from '@/lib/db';
import { promptLibrary } from '@/db/schema';
import { updatePromptSchema } from '@/features/prompts/schema';

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const { id } = await params;
  const result = updatePromptSchema.safeParse(await req.json());
  if (!result.success) return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
  const body = result.data;

  const [updated] = await db
    .update(promptLibrary)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(promptLibrary.id, id), eq(promptLibrary.userId, authResult.user.id)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    prompt: {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const { id } = await params;

  const deleted = await db
    .delete(promptLibrary)
    .where(and(eq(promptLibrary.id, id), eq(promptLibrary.userId, authResult.user.id)))
    .returning({ id: promptLibrary.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
