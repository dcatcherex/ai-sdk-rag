import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin';
import { db } from '@/lib/db';
import { stockImage } from '@/db/schema/tools';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { id } = await params;
  await db.delete(stockImage).where(eq(stockImage.id, id));
  return Response.json({ ok: true });
}
