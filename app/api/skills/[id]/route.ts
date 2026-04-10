import { headers } from 'next/headers';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { deleteSkill, getSkillById, updateSkill } from '@/features/skills/service';

const updateSchema = z.object({
  name: z.string().min(1).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  description: z.string().max(300).optional(),
  activationMode: z.enum(['rule', 'model']).optional(),
  triggerType: z.enum(['slash', 'keyword', 'always']).optional(),
  trigger: z.string().max(100).nullable().optional(),
  promptFragment: z.string().min(1).optional(),
  enabledTools: z.array(z.string()).optional(),
  imageUrl: z.string().url().optional().nullable(),
  isPublic: z.boolean().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const { id } = await params;
  const skill = await getSkillById(session.user.id, id);
  if (!skill) return new Response('Not Found', { status: 404 });
  return Response.json(skill);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const result = updateSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const skill = await updateSkill(session.user.id, id, result.data);
  if (!skill) return new Response('Not Found', { status: 404 });
  return Response.json(skill);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const { id } = await params;
  const ok = await deleteSkill(session.user.id, id);
  if (!ok) return new Response('Not Found', { status: 404 });
  return Response.json({ success: true });
}
