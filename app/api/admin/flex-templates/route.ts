import { z } from 'zod';
import { nanoid } from 'nanoid';
import { eq, desc } from 'drizzle-orm';

import { requireAdmin } from '@/lib/admin';
import { db } from '@/lib/db';
import { lineFlexTemplate } from '@/db/schema';

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  category: z.enum(['agriculture', 'ecommerce', 'general', 'alert', 'other']).default('general'),
  tags: z.array(z.string()).optional(),
  flexPayload: z.record(z.string(), z.unknown()),
  altText: z.string().min(1).max(400),
  previewImageUrl: z.string().url().nullable().optional(),
});

export async function GET() {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const templates = await db
    .select()
    .from(lineFlexTemplate)
    .orderBy(desc(lineFlexTemplate.updatedAt));

  return Response.json({ templates });
}

export async function POST(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const body = await req.json();
  const result = createSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const { name, description, category, tags, flexPayload, altText, previewImageUrl } = result.data;

  const id = nanoid();
  const now = new Date();
  await db.insert(lineFlexTemplate).values({
    id,
    name,
    description: description ?? null,
    category,
    tags: tags ?? [],
    flexPayload,
    altText,
    previewImageUrl: previewImageUrl ?? null,
    catalogStatus: 'draft',
    createdBy: adminCheck.session.user.id,
    createdAt: now,
    updatedAt: now,
  });

  const rows = await db.select().from(lineFlexTemplate).where(eq(lineFlexTemplate.id, id)).limit(1);
  return Response.json({ template: rows[0] }, { status: 201 });
}
