import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { installSkill } from '@/features/skills/service';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const { id } = await params;
  const skill = await installSkill(session.user.id, id);
  if (!skill) return new Response('Skill not found or not public', { status: 404 });
  return Response.json(skill, { status: 201 });
}
