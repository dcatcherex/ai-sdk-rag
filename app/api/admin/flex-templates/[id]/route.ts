import { z } from 'zod';
import { eq } from 'drizzle-orm';

import { requireAdmin } from '@/lib/admin';
import { db } from '@/lib/db';
import { lineFlexTemplate } from '@/db/schema';
import { hasRichMessageTemplate } from '@/features/rich-messages/registry';
import { getDbRichMessageTemplateByKey } from '@/features/rich-messages/server/repository';

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  category: z.enum(['agriculture', 'ecommerce', 'general', 'alert', 'other']).optional(),
  tags: z.array(z.string()).optional(),
  templateType: z.enum(['line_only', 'line_override']).optional(),
  richTemplateKey: z.string().min(1).max(120).nullable().optional(),
  flexPayload: z.record(z.string(), z.unknown()).optional(),
  altText: z.string().min(1).max(400).optional(),
  previewImageUrl: z.string().url().nullable().optional(),
});

async function isKnownRichTemplateKey(key: string) {
  if (hasRichMessageTemplate(key)) {
    return true;
  }

  const dbTemplate = await getDbRichMessageTemplateByKey(key);
  return Boolean(dbTemplate);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { id } = await params;
  const body = await req.json();
  const result = updateSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const existing = await db.select().from(lineFlexTemplate).where(eq(lineFlexTemplate.id, id)).limit(1);
  if (!existing[0]) return new Response('Not Found', { status: 404 });

  const nextTemplateType = result.data.templateType ?? existing[0].templateType;
  const requestedRichTemplateKey = result.data.richTemplateKey !== undefined
    ? result.data.richTemplateKey
    : existing[0].richTemplateKey;
  const nextRichTemplateKey = nextTemplateType === 'line_override'
    ? requestedRichTemplateKey
    : null;

  if (nextTemplateType === 'line_override' && !nextRichTemplateKey) {
    return new Response('LINE override templates must link to a rich template key', { status: 400 });
  }

  if (nextRichTemplateKey && !(await isKnownRichTemplateKey(nextRichTemplateKey))) {
    return new Response('Linked rich template key does not exist', { status: 400 });
  }

  await db
    .update(lineFlexTemplate)
    .set({
      ...result.data,
      ...(result.data.templateType !== undefined ? { templateType: nextTemplateType } : {}),
      ...(result.data.templateType !== undefined || result.data.richTemplateKey !== undefined
        ? { richTemplateKey: nextRichTemplateKey ?? null }
        : {}),
      updatedAt: new Date(),
    })
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
