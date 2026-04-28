import { z } from 'zod';
import { and, eq } from 'drizzle-orm';

import { requireUser } from '@/lib/auth-server';
import { db } from '@/lib/db';
import { lineFlexDraft } from '@/db/schema';

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  altText: z.string().min(1).max(400).optional(),
  flexPayload: z.record(z.string(), z.unknown()).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  const body = await req.json();
  const result = updateSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const existing = await db
    .select()
    .from(lineFlexDraft)
    .where(and(eq(lineFlexDraft.id, id), eq(lineFlexDraft.userId, authResult.user.id)))
    .limit(1);

  if (!existing[0]) return new Response('Not Found', { status: 404 });

  await db
    .update(lineFlexDraft)
    .set({ ...result.data, updatedAt: new Date() })
    .where(eq(lineFlexDraft.id, id));

  const rows = await db.select().from(lineFlexDraft).where(eq(lineFlexDraft.id, id)).limit(1);
  return Response.json({ draft: rows[0] });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  await db
    .delete(lineFlexDraft)
    .where(and(eq(lineFlexDraft.id, id), eq(lineFlexDraft.userId, authResult.user.id)));

  return Response.json({ ok: true });
}
