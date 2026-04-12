import { requireAdmin } from '@/lib/admin';
import { archiveAdminAgentTemplate } from '@/features/agents/server/catalog';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { id } = await params;
  const agent = await archiveAdminAgentTemplate(id);
  if (!agent) return Response.json({ error: 'Not Found' }, { status: 404 });

  return Response.json({ agent });
}
