import { eq, or, and } from 'drizzle-orm';
import { requireUser } from '@/lib/auth-server';
import { isAdminEmail } from '@/lib/admin-emails';
import { db } from '@/lib/db';
import { agentSkill } from '@/db/schema';
import { exportSkill } from '@/features/skills/server/export';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  const { user } = authResult;
  const isAdmin = isAdminEmail(user.email);

  // Verify access: own skill, public skill, or admin
  const [row] = await db
    .select({ id: agentSkill.id, userId: agentSkill.userId, isPublic: agentSkill.isPublic })
    .from(agentSkill)
    .where(eq(agentSkill.id, id))
    .limit(1);

  if (!row) return new Response('Skill not found', { status: 404 });

  const canAccess = isAdmin || row.userId === user.id || row.isPublic;
  if (!canAccess) return new Response('Forbidden', { status: 403 });

  try {
    const result = await exportSkill(id);

    const contentType = result.isZip ? 'application/zip' : 'text/markdown; charset=utf-8';
    const body = result.isZip
      ? Buffer.from(result.data as Uint8Array)
      : result.data as string;

    return new Response(body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed';
    return new Response(message, { status: 422 });
  }
}
