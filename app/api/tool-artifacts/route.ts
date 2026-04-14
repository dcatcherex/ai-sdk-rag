import { headers } from 'next/headers';
import { desc, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { toolArtifact, toolRun } from '@/db/schema';

const MAX_LIMIT = 100;

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get('limit') ?? '40');
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), MAX_LIMIT) : 40;

  const rows = await db
    .select({
      id: toolArtifact.id,
      kind: toolArtifact.kind,
      format: toolArtifact.format,
      storageUrl: toolArtifact.storageUrl,
      payloadJson: toolArtifact.payloadJson,
      createdAt: toolArtifact.createdAt,
      toolRunId: toolArtifact.toolRunId,
      toolSlug: toolRun.toolSlug,
    })
    .from(toolArtifact)
    .innerJoin(toolRun, eq(toolArtifact.toolRunId, toolRun.id))
    .where(eq(toolRun.userId, session.user.id))
    .orderBy(desc(toolArtifact.createdAt))
    .limit(limit);

  return Response.json({
    artifacts: rows.map((row) => ({
      ...row,
      createdAtMs: row.createdAt.getTime(),
    })),
  });
}
