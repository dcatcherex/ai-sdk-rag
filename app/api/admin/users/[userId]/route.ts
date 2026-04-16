import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { user } from '@/db/schema';
import { requireAdmin } from '@/lib/admin';

type Context = { params: Promise<{ userId: string }> };

export async function DELETE(_req: Request, context: Context) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { userId } = await context.params;

  const deleted = await db.delete(user).where(eq(user.id, userId)).returning({ id: user.id });

  if (deleted.length === 0) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  return Response.json({ ok: true });
}
