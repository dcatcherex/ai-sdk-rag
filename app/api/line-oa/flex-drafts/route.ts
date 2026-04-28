import { z } from 'zod';
import { nanoid } from 'nanoid';
import { and, eq } from 'drizzle-orm';

import { requireUser } from '@/lib/auth-server';
import { db } from '@/lib/db';
import { lineFlexDraft } from '@/db/schema';

const createSchema = z.object({
  name: z.string().min(1).max(100),
  altText: z.string().min(1).max(400),
  flexPayload: z.record(z.string(), z.unknown()),
  channelId: z.string().nullable().optional(),
  templateId: z.string().nullable().optional(),
});

export async function GET(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get('channelId');

  const conditions = [eq(lineFlexDraft.userId, authResult.user.id)];
  if (channelId) conditions.push(eq(lineFlexDraft.channelId, channelId));

  const drafts = await db
    .select()
    .from(lineFlexDraft)
    .where(and(...conditions))
    .orderBy(lineFlexDraft.updatedAt);

  return Response.json({ drafts });
}

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json();
  const result = createSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const { name, altText, flexPayload, channelId, templateId } = result.data;
  const id = nanoid();
  const now = new Date();

  await db.insert(lineFlexDraft).values({
    id,
    userId: authResult.user.id,
    channelId: channelId ?? null,
    name,
    altText,
    flexPayload,
    templateId: templateId ?? null,
    createdAt: now,
    updatedAt: now,
  });

  const rows = await db.select().from(lineFlexDraft).where(eq(lineFlexDraft.id, id)).limit(1);
  return Response.json({ draft: rows[0] }, { status: 201 });
}
