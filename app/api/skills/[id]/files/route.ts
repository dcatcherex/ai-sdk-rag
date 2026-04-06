import { headers } from 'next/headers';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { createSkillFile, deleteSkillFile, getSkillFiles, SkillFileMutationError } from '@/features/skills/service';

const createFileSchema = z.object({
  path: z.string().min(1).max(300),
  textContent: z.string(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const { id } = await params;
  const files = await getSkillFiles(session.user.id, id);
  if (!files) return new Response('Not Found', { status: 404 });

  return Response.json(files.map((file) => ({
    id: file.id,
    skillId: file.skillId,
    relativePath: file.relativePath,
    fileKind: file.fileKind,
    mediaType: file.mediaType,
    sizeBytes: file.sizeBytes,
    checksum: file.checksum,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  })));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const result = createFileSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  try {
    const file = await createSkillFile(session.user.id, id, result.data.path, result.data.textContent);
    return Response.json(file, { status: 201 });
  } catch (error) {
    return toMutationErrorResponse(error);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const { id } = await params;
  const path = new URL(req.url).searchParams.get('path');
  if (!path) return new Response('Bad Request: path is required', { status: 400 });

  try {
    await deleteSkillFile(session.user.id, id, path);
    return Response.json({ success: true });
  } catch (error) {
    return toMutationErrorResponse(error);
  }
}

function toMutationErrorResponse(error: unknown): Response {
  if (error instanceof SkillFileMutationError) {
    return new Response(error.message, { status: error.statusCode });
  }

  throw error;
}
