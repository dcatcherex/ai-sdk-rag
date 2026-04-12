import { requireAdmin } from '@/lib/admin';
import { archiveAdminSkillTemplate } from '@/features/skills/service';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { id } = await params;
  const skill = await archiveAdminSkillTemplate(id);
  if (!skill) return Response.json({ error: 'Not Found' }, { status: 404 });

  return Response.json({ skill });
}
