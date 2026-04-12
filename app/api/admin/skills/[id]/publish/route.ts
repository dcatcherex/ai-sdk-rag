import { z } from 'zod';

import { requireAdmin } from '@/lib/admin';
import { publishAdminSkillTemplate } from '@/features/skills/service';

const bodySchema = z.object({
  changelog: z.string().max(4000).nullable().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: 'Bad Request' }, { status: 400 });

  const { id } = await params;
  const skill = await publishAdminSkillTemplate(id, parsed.data.changelog);
  if (!skill) return Response.json({ error: 'Not Found' }, { status: 404 });

  return Response.json({ skill });
}
