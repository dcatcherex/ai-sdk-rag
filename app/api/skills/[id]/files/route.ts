import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getSkillFiles } from '@/features/skills/service';

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
