import { eq } from 'drizzle-orm';

import { requireAdmin } from '@/lib/admin';
import { db } from '@/lib/db';
import { lineFlexTemplate } from '@/db/schema';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { id } = await params;
  const existing = await db.select().from(lineFlexTemplate).where(eq(lineFlexTemplate.id, id)).limit(1);
  if (!existing[0]) return new Response('Not Found', { status: 404 });

  await db
    .update(lineFlexTemplate)
    .set({ catalogStatus: 'published', publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(lineFlexTemplate.id, id));

  return Response.json({ ok: true });
}
