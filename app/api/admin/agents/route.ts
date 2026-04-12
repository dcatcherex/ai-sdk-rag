import { z } from 'zod';

import { requireAdmin } from '@/lib/admin';
import {
  createAdminAgentTemplate,
  listAdminAgentTemplates,
} from '@/features/agents/server/catalog';

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).nullable().optional(),
  systemPrompt: z.string().min(1),
  modelId: z.string().nullable().optional(),
  enabledTools: z.array(z.string()).optional(),
  starterPrompts: z.array(z.string().max(100)).max(4).optional(),
  imageUrl: z.string().url().nullable().optional(),
  cloneBehavior: z.enum(['locked', 'editable_copy']).optional(),
  updatePolicy: z.enum(['none', 'notify', 'auto_for_locked']).optional(),
  lockedFields: z.array(z.string()).optional(),
  changelog: z.string().max(4000).nullable().optional(),
});

export async function GET() {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const agents = await listAdminAgentTemplates();
  return Response.json({ agents });
}

export async function POST(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: 'Bad Request' }, { status: 400 });

  const agent = await createAdminAgentTemplate(parsed.data);
  return Response.json({ agent }, { status: 201 });
}
