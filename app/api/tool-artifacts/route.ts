import { desc, eq } from 'drizzle-orm';
import { requireUser } from "@/lib/auth-server";
import { db } from '@/lib/db';
import { toolArtifact, toolRun } from '@/db/schema';

const MAX_LIMIT = 100;

export async function GET(request: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
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
    .where(eq(toolRun.userId, authResult.user.id))
    .orderBy(desc(toolArtifact.createdAt))
    .limit(limit);

  return Response.json({
    artifacts: rows.map((row) => ({
      ...row,
      createdAtMs: row.createdAt.getTime(),
    })),
  });
}
