import { headers } from 'next/headers';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { createSkill, getSkills } from '@/features/skills/service';

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(1024),
  activationMode: z.enum(['rule', 'model']).optional(),
  triggerType: z.enum(['slash', 'keyword', 'always']),
  trigger: z.string().max(100).nullable().optional(),
  promptFragment: z.string().min(1),
  enabledTools: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
});

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const skills = await getSkills(session.user.id);
  return Response.json(skills);
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const body = await req.json();
  const result = createSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const skill = await createSkill(session.user.id, result.data);
  return Response.json(skill, { status: 201 });
}
