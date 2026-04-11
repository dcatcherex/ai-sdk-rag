import { eq } from 'drizzle-orm';
import { toolRun, user } from '@/db/schema';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';

export async function GET(
  _req: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { runId } = await context.params;

  const rows = await db
    .select({
      id: toolRun.id,
      userId: toolRun.userId,
      userName: user.name,
      userEmail: user.email,
      toolSlug: toolRun.toolSlug,
      threadId: toolRun.threadId,
      source: toolRun.source,
      status: toolRun.status,
      inputJson: toolRun.inputJson,
      outputJson: toolRun.outputJson,
      errorMessage: toolRun.errorMessage,
      createdAt: toolRun.createdAt,
      completedAt: toolRun.completedAt,
    })
    .from(toolRun)
    .leftJoin(user, eq(toolRun.userId, user.id))
    .where(eq(toolRun.id, runId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return Response.json({ error: 'Tool run not found' }, { status: 404 });
  }

  return Response.json({
    ...row,
    status: row.status === 'success' || row.status === 'error' ? row.status : 'pending',
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  });
}
