import { eq } from 'drizzle-orm';

import { requireAdmin } from '@/lib/admin';
import { db } from '@/lib/db';
import { lineFlexTemplate } from '@/db/schema';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { id } = await params;
  await db
    .update(lineFlexTemplate)
    .set({ catalogStatus: 'archived', updatedAt: new Date() })
    .where(eq(lineFlexTemplate.id, id));

  return Response.json({ ok: true });
}
