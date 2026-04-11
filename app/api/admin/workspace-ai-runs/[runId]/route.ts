import { eq } from 'drizzle-orm';
import { user, workspaceAiRun } from '@/db/schema';
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
      id: workspaceAiRun.id,
      userId: workspaceAiRun.userId,
      userName: user.name,
      userEmail: user.email,
      kind: workspaceAiRun.kind,
      entityType: workspaceAiRun.entityType,
      entityId: workspaceAiRun.entityId,
      route: workspaceAiRun.route,
      status: workspaceAiRun.status,
      modelId: workspaceAiRun.modelId,
      inputJson: workspaceAiRun.inputJson,
      outputJson: workspaceAiRun.outputJson,
      errorMessage: workspaceAiRun.errorMessage,
      createdAt: workspaceAiRun.createdAt,
      completedAt: workspaceAiRun.completedAt,
    })
    .from(workspaceAiRun)
    .leftJoin(user, eq(workspaceAiRun.userId, user.id))
    .where(eq(workspaceAiRun.id, runId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return Response.json({ error: 'Workspace AI run not found' }, { status: 404 });
  }

  return Response.json({
    ...row,
    route: row.route === 'image' ? 'image' : 'text',
    status: row.status === 'success' || row.status === 'error' ? row.status : 'pending',
    entityType: row.entityType === 'skill' ? 'skill' : 'agent',
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  });
}
