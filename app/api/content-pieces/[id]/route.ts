import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import {
  getContentPiece,
  updateContentPiece,
  deleteContentPiece,
} from '@/features/long-form/service';
import { updateContentPieceSchema } from '@/features/long-form/schema';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const piece = await getContentPiece(session.user.id, id);
  if (!piece) return Response.json({ error: 'Not found' }, { status: 404 });

  return Response.json(piece);
}

export async function PUT(req: Request, { params }: RouteParams) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as unknown;
  const result = updateContentPieceSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: 'Bad Request', issues: result.error.issues }, { status: 400 });
  }

  const piece = await updateContentPiece(session.user.id, id, result.data);
  if (!piece) return Response.json({ error: 'Not found' }, { status: 404 });

  return Response.json(piece);
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await deleteContentPiece(session.user.id, id);
  return new Response(null, { status: 204 });
}
