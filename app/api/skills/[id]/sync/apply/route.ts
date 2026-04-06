import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { applySkillSync } from '@/features/skills/service';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const { id } = await params;

  try {
    const result = await applySkillSync(session.user.id, id);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'Skill not found' ? 404 : 400;
    return new Response(message, { status });
  }
}
