import { z } from 'zod';
import { requireUser } from "@/lib/auth-server";
import { getSkillFileContent, SkillFileMutationError, updateSkillFileContent } from '@/features/skills/service';

const updateFileSchema = z.object({
  path: z.string().min(1).max(300),
  textContent: z.string(),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  const path = new URL(req.url).searchParams.get('path');
  if (!path) return new Response('Bad Request: path is required', { status: 400 });

  const file = await getSkillFileContent(authResult.user.id, id, path);
  if (!file) return new Response('Not Found', { status: 404 });

  return Response.json(file);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { id } = await params;
  const body = await req.json();
  const result = updateFileSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  try {
    const file = await updateSkillFileContent(authResult.user.id, id, result.data.path, result.data.textContent);
    return Response.json(file);
  } catch (error) {
    if (error instanceof SkillFileMutationError) {
      return new Response(error.message, { status: error.statusCode });
    }

    throw error;
  }
}
