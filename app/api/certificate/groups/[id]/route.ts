import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getCurrentUser } from "@/lib/auth-server";
import { db } from '@/lib/db';
import { recipientGroup } from '@/db/schema';

async function getUserId()  {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

type Params = { params: Promise<{ id: string }> };

// GET /api/certificate/groups/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const [group] = await db
    .select()
    .from(recipientGroup)
    .where(and(eq(recipientGroup.id, id), eq(recipientGroup.userId, userId)));

  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ group });
}

// PUT /api/certificate/groups/[id] — update name, description, or recipients
export async function PUT(req: NextRequest, { params }: Params) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as {
    name?: string;
    description?: string;
    recipients?: Array<{ id: string; values: Record<string, string> }>;
  };

  const updates: Partial<typeof recipientGroup.$inferInsert> = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.description !== undefined) updates.description = body.description?.trim() || null;
  if (body.recipients !== undefined) updates.recipients = body.recipients;

  const [updated] = await db
    .update(recipientGroup)
    .set(updates)
    .where(and(eq(recipientGroup.id, id), eq(recipientGroup.userId, userId)))
    .returning();

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ group: updated });
}

// DELETE /api/certificate/groups/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const deleted = await db
    .delete(recipientGroup)
    .where(and(eq(recipientGroup.id, id), eq(recipientGroup.userId, userId)))
    .returning();

  if (deleted.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ success: true });
}
