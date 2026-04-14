import { z } from 'zod';

import { requireAdmin } from '@/lib/admin';
import {
  getAdminSkillTemplateById,
  updateAdminSkillTemplate,
} from '@/features/skills/service';

const updateSchema = z.object({
  name: z.string().min(1).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  category: z.string().max(64).nullable().optional(),
  description: z.string().max(1024).nullable().optional(),
  triggerType: z.enum(['slash', 'keyword', 'always']).optional(),
  trigger: z.string().max(100).nullable().optional(),
  promptFragment: z.string().min(1).optional(),
  enabledTools: z.array(z.string()).optional(),
  activationMode: z.enum(['rule', 'model']).optional(),
  imageUrl: z.string().url().nullable().optional(),
  cloneBehavior: z.enum(['locked', 'editable_copy']).optional(),
  updatePolicy: z.enum(['none', 'notify', 'auto_for_locked']).optional(),
  lockedFields: z.array(z.string()).optional(),
  changelog: z.string().max(4000).nullable().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { id } = await params;
  const skill = await getAdminSkillTemplateById(id);
  if (!skill) return Response.json({ error: 'Not Found' }, { status: 404 });

  return Response.json({ skill });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: 'Bad Request' }, { status: 400 });

  const { id } = await params;
  const skill = await updateAdminSkillTemplate(id, parsed.data);
  if (!skill) return Response.json({ error: 'Not Found' }, { status: 404 });

  return Response.json({ skill });
}
