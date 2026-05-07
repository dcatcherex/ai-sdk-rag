import { z } from 'zod';
import { requireAdmin } from '@/lib/admin';
import { runAgentAudit } from '@/features/agents/server/audit-service';

const querySchema = z.object({
  testMessage: z.string().max(1000).optional(),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { id } = await params;
  const parsedQuery = querySchema.safeParse({
    testMessage: new URL(req.url).searchParams.get('testMessage') ?? undefined,
  });
  if (!parsedQuery.success) {
    return Response.json({ error: 'Bad Request' }, { status: 400 });
  }

  const testMessage = parsedQuery.data.testMessage ?? '';
  const result = await runAgentAudit(id, testMessage);
  if (!result) return Response.json({ error: 'Not found' }, { status: 404 });

  return Response.json(result.audit);
}
