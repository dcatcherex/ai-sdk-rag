import { z } from 'zod';

import { requireAdmin } from '@/lib/admin';
import {
  createAdminSkillTemplate,
  listAdminSkillTemplates,
} from '@/features/skills/service';

const createSchema = z.object({
  name: z.string().min(1).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().max(1024).nullable().optional(),
  triggerType: z.enum(['slash', 'keyword', 'always']).optional(),
  trigger: z.string().max(100).nullable().optional(),
  promptFragment: z.string().min(1),
  enabledTools: z.array(z.string()).optional(),
  activationMode: z.enum(['rule', 'model']).optional(),
  imageUrl: z.string().url().nullable().optional(),
  cloneBehavior: z.enum(['locked', 'editable_copy']).optional(),
  updatePolicy: z.enum(['none', 'notify', 'auto_for_locked']).optional(),
  lockedFields: z.array(z.string()).optional(),
  changelog: z.string().max(4000).nullable().optional(),
});

export async function GET() {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const skills = await listAdminSkillTemplates();
  return Response.json({ skills });
}

export async function POST(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: 'Bad Request' }, { status: 400 });

  const skill = await createAdminSkillTemplate(parsed.data);
  return Response.json({ skill }, { status: 201 });
}
