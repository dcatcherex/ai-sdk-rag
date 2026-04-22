import { z } from 'zod';

import { requireAdmin } from '@/lib/admin';
import {
  deleteAdminAgentTemplate,
  getAdminAgentTemplateById,
  updateAdminAgentTemplate,
} from '@/features/agents/server/catalog';
import {
  brandAccessPolicySchema,
  brandModeSchema,
  fallbackBehaviorSchema,
} from '@/features/agents/server/brand-config';

const mcpServerSchema = z.object({
  name: z.string().min(1).max(50),
  url: z.string().url(),
  description: z.string().optional(),
  authType: z.enum(['none', 'bearer', 'api_key']).optional(),
  credentialKey: z.string().optional(),
});

const attachmentSchema = z.object({
  skillId: z.string().min(1),
  isEnabled: z.boolean().optional(),
  activationModeOverride: z.enum(['rule', 'model']).nullable().optional(),
  triggerTypeOverride: z.enum(['slash', 'keyword', 'always']).nullable().optional(),
  triggerOverride: z.string().max(100).nullable().optional(),
  priority: z.number().int().optional(),
  notes: z.string().nullable().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).nullable().optional(),
  systemPrompt: z.string().min(1).optional(),
  modelId: z.string().nullable().optional(),
  enabledTools: z.array(z.string()).optional(),
  skillAttachments: z.array(attachmentSchema).optional(),
  starterPrompts: z.array(z.string().max(100)).max(4).optional(),
  brandId: z.string().nullable().optional(),
  brandMode: brandModeSchema.optional(),
  brandAccessPolicy: brandAccessPolicySchema.optional(),
  requiresBrandForRun: z.boolean().optional(),
  fallbackBehavior: fallbackBehaviorSchema.optional(),
  imageUrl: z.string().url().nullable().optional(),
  cloneBehavior: z.enum(['locked', 'editable_copy']).optional(),
  updatePolicy: z.enum(['none', 'notify', 'auto_for_locked']).optional(),
  lockedFields: z.array(z.string()).optional(),
  changelog: z.string().max(4000).nullable().optional(),
  mcpServers: z.array(mcpServerSchema).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { id } = await params;
  const agent = await getAdminAgentTemplateById(id);
  if (!agent) return Response.json({ error: 'Not Found' }, { status: 404 });

  return Response.json({ agent });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { id } = await params;
  const deleted = await deleteAdminAgentTemplate(id);
  if (!deleted) return Response.json({ error: 'Not Found' }, { status: 404 });

  return new Response(null, { status: 204 });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: 'Bad Request' }, { status: 400 });

  const { id } = await params;
  const agent = await updateAdminAgentTemplate(id, parsed.data);
  if (!agent) return Response.json({ error: 'Not Found' }, { status: 404 });

  return Response.json({ agent });
}
