import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getUserContentPieces, createContentPiece } from '@/features/long-form/service';
import { createContentPieceSchema } from '@/features/long-form/schema';
import type { ContentType, ContentStatus } from '@/features/long-form/types';

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const contentType = searchParams.get('contentType') as ContentType | null;
  const status = searchParams.get('status') as ContentStatus | null;
  const brandId = searchParams.get('brandId');

  const pieces = await getUserContentPieces(session.user.id, {
    contentType: contentType ?? undefined,
    status: status ?? undefined,
    brandId: brandId ?? undefined,
  });

  return Response.json(pieces);
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as unknown;
  const result = createContentPieceSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: 'Bad Request', issues: result.error.issues }, { status: 400 });
  }

  const piece = await createContentPiece(session.user.id, result.data);
  return Response.json(piece, { status: 201 });
}
