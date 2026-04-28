import { z } from 'zod';
import { eq } from 'drizzle-orm';

import { requireAdmin } from '@/lib/admin';
import { db } from '@/lib/db';
import { lineFlexTemplate } from '@/db/schema';

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  category: z.enum(['agriculture', 'ecommerce', 'general', 'alert', 'other']).optional(),
  tags: z.array(z.string()).optional(),
  flexPayload: z.record(z.string(), z.unknown()).optional(),
  altText: z.string().min(1).max(400).optional(),
  previewImageUrl: z.string().url().nullable().optional(),
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { id } = await params;
  const body = await req.json();
  const result = updateSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const existing = await db.select().from(lineFlexTemplate).where(eq(lineFlexTemplate.id, id)).limit(1);
  if (!existing[0]) return new Response('Not Found', { status: 404 });

  await db
    .update(lineFlexTemplate)
    .set({ ...result.data, updatedAt: new Date() })
    .where(eq(lineFlexTemplate.id, id));

  const rows = await db.select().from(lineFlexTemplate).where(eq(lineFlexTemplate.id, id)).limit(1);
  return Response.json({ template: rows[0] });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { id } = await params;
  await db.delete(lineFlexTemplate).where(eq(lineFlexTemplate.id, id));
  return Response.json({ ok: true });
}
