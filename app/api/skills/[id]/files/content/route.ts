import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getSkillFileContent } from '@/features/skills/service';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const { id } = await params;
  const path = new URL(req.url).searchParams.get('path');
  if (!path) return new Response('Bad Request: path is required', { status: 400 });

  const file = await getSkillFileContent(session.user.id, id, path);
  if (!file) return new Response('Not Found', { status: 404 });

  return Response.json(file);
}
