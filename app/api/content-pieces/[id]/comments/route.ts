import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getContentComments, createComment } from '@/features/collaboration/service';

const createCommentSchema = z.object({
  body: z.string().min(1),
  parentId: z.string().nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  const { id: contentPieceId } = await params;
  const comments = await getContentComments(contentPieceId);
  return NextResponse.json(comments);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  const { id: contentPieceId } = await params;
  const body = await req.json();
  const result = createCommentSchema.safeParse(body);
  if (!result.success) return new NextResponse('Bad Request', { status: 400 });

  const comment = await createComment({
    contentPieceId,
    userId: session.user.id,
    parentId: result.data.parentId ?? null,
    body: result.data.body,
  });
  return NextResponse.json(comment, { status: 201 });
}
