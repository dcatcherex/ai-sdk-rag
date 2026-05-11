import { eq } from 'drizzle-orm';

import { requireAdmin } from '@/lib/admin';
import { db } from '@/lib/db';
import { lineFlexTemplate } from '@/db/schema';
import { hasRichMessageTemplate } from '@/features/rich-messages/registry';
import { getDbRichMessageTemplateByKey } from '@/features/rich-messages/server/repository';

async function isKnownRichTemplateKey(key: string) {
  if (hasRichMessageTemplate(key)) {
    return true;
  }

  const dbTemplate = await getDbRichMessageTemplateByKey(key);
  return Boolean(dbTemplate);
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { id } = await params;
  const existing = await db.select().from(lineFlexTemplate).where(eq(lineFlexTemplate.id, id)).limit(1);
  if (!existing[0]) return new Response('Not Found', { status: 404 });

  if (existing[0].templateType === 'line_override') {
    if (!existing[0].richTemplateKey) {
      return new Response('LINE override templates must link to a rich template key before publish', { status: 400 });
    }

    if (!(await isKnownRichTemplateKey(existing[0].richTemplateKey))) {
      return new Response('Linked rich template key does not exist', { status: 400 });
    }
  }

  await db
    .update(lineFlexTemplate)
    .set({ catalogStatus: 'published', publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(lineFlexTemplate.id, id));

  return Response.json({ ok: true });
}
